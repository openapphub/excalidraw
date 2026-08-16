import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";
import { initializeApp } from "firebase/app";
import {
  getStorage,
  ref,
  uploadBytes,
  connectStorageEmulator,
} from "firebase/storage";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";
import { sceneClientHeaders } from "../auth/sceneClient";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

// private
// -----------------------------------------------------------------------------

let FIREBASE_CONFIG: Record<string, any>;
try {
  FIREBASE_CONFIG = JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG);
} catch (error: any) {
  console.warn(
    `Error JSON parsing firebase config. Supplied value: ${
      import.meta.env.VITE_APP_FIREBASE_CONFIG
    }`,
  );
  FIREBASE_CONFIG = {};
}

let firebaseApp: ReturnType<typeof initializeApp> | null = null;
let firebaseStorage: ReturnType<typeof getStorage> | null = null;

const _initializeFirebase = () => {
  if (!firebaseApp) {
    firebaseApp = initializeApp(FIREBASE_CONFIG);
  }
  return firebaseApp;
};

const _getStorage = () => {
  if (!firebaseStorage) {
    firebaseStorage = getStorage(_initializeFirebase());
    // Self-hosted: point Storage at the local Go backend over plain HTTP
    // (same host as Firestore). Without this the SDK uses https + the
    // firebasestorage.googleapis.com host and uploads fail.
    const host = import.meta.env.VITE_APP_FIRESTORE_EMULATOR_HOST;
    if (host) {
      const [h, p] = host.split(":");
      connectStorageEmulator(firebaseStorage, h, Number(p));
    }
  }
  return firebaseStorage;
};

// -----------------------------------------------------------------------------

export const loadFirebaseStorage = async () => {
  return _getStorage();
};

type FirebaseStoredScene = {
  sceneVersion: number;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
};

type RoomSnapshot = {
  revision: number;
  sceneVersion: number;
  ciphertext: string;
  iv: string;
  updatedAt: string;
};

const ROOM_SNAPSHOT_MAX_RETRIES = 5;

const uint8ArrayToBase64 = (bytes: Uint8Array<ArrayBuffer>) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return window.btoa(binary);
};

const base64ToUint8Array = (value: string) => {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const roomSnapshotUrl = (roomId: string) =>
  `/api/v2/collab/rooms/${encodeURIComponent(roomId)}`;

const roomSnapshotHeaders = (includeContentType = false) => {
  const token = localStorage.getItem("token");
  return {
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...sceneClientHeaders(),
  };
};

const loadRoomSnapshot = async (roomId: string) => {
  const response = await fetch(roomSnapshotUrl(roomId), {
    headers: roomSnapshotHeaders(),
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`room snapshot load failed: ${response.status}`);
  }
  return (await response.json()) as RoomSnapshot;
};

const saveRoomSnapshot = async (
  roomId: string,
  expectedRevision: number,
  storedScene: FirebaseStoredScene,
) => {
  const response = await fetch(roomSnapshotUrl(roomId), {
    method: "PUT",
    headers: roomSnapshotHeaders(true),
    body: JSON.stringify({
      expectedRevision,
      sceneVersion: storedScene.sceneVersion,
      ciphertext: uint8ArrayToBase64(storedScene.ciphertext),
      iv: uint8ArrayToBase64(storedScene.iv),
    }),
  });
  if (response.status === 409) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`room snapshot save failed: ${response.status}`);
  }
  return (await response.json()) as RoomSnapshot;
};

const decodeRoomSnapshot = (snapshot: RoomSnapshot): FirebaseStoredScene => ({
  sceneVersion: snapshot.sceneVersion,
  ciphertext: base64ToUint8Array(snapshot.ciphertext),
  iv: base64ToUint8Array(snapshot.iv),
});

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: FirebaseStoredScene,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const decrypted = await decryptData(data.iv, data.ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

class FirebaseSceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return FirebaseSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    FirebaseSceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return FirebaseSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveFilesToFirebase = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  const storageHost = import.meta.env.VITE_APP_FIRESTORE_EMULATOR_HOST;
  if (storageHost) {
    const token = localStorage.getItem("token");
    await Promise.all(
      files.map(async ({ id, buffer }) => {
        try {
          const objectPath = `${prefix}/${id}`.replace(/^\//, "");
          const boundary = `excalidraw-${crypto.randomUUID()}`;
          const metadata = JSON.stringify({
            name: objectPath,
            cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
            contentType: MIME_TYPES.binary,
          });
          const fileBuffer = new ArrayBuffer(buffer.byteLength);
          new Uint8Array(fileBuffer).set(buffer);
          const body = new Blob([
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
            `--${boundary}\r\nContent-Type: ${MIME_TYPES.binary}\r\n\r\n`,
            fileBuffer,
            `\r\n--${boundary}--\r\n`,
          ]);
          const response = await fetch(
            `/v0/b/${encodeURIComponent(FIREBASE_CONFIG.storageBucket)}/o`,
            {
              method: "POST",
              headers: {
                "Content-Type": `multipart/related; boundary=${boundary}`,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...sceneClientHeaders(),
              },
              body,
            },
          );
          if (!response.ok) {
            throw new Error(`storage upload failed: ${response.status}`);
          }
          savedFiles.push(id);
        } catch {
          erroredFiles.push(id);
        }
      }),
    );
    return { savedFiles, erroredFiles };
  }

  const storage = await loadFirebaseStorage();

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const storageRef = ref(storage, `${prefix}/${id}`);
        await uploadBytes(storageRef, buffer, {
          cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
        });
        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

const createFirebaseSceneDocument = async (
  elements: readonly SyncableExcalidrawElement[],
  roomKey: string,
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  return {
    sceneVersion,
    ciphertext: new Uint8Array(ciphertext),
    iv,
  } as FirebaseStoredScene;
};

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
  opts?: { replace?: boolean },
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // bail if no room exists as there's nothing we can do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    (!opts?.replace && isSavedToFirebase(portal, elements))
  ) {
    return null;
  }

  for (let attempt = 0; attempt < ROOM_SNAPSHOT_MAX_RETRIES; attempt++) {
    const snapshot = await loadRoomSnapshot(roomId);
    let storedElements = elements;

    if (snapshot && !opts?.replace) {
      const previousElements = getSyncableElements(
        restoreElements(
          await decryptElements(decodeRoomSnapshot(snapshot), roomKey),
          null,
        ),
      );
      storedElements = getSyncableElements(
        reconcileElements(
          elements,
          previousElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
          appState,
        ),
      );
    }

    const storedScene = await createFirebaseSceneDocument(
      storedElements,
      roomKey,
    );
    const savedSnapshot = await saveRoomSnapshot(
      roomId,
      snapshot?.revision ?? 0,
      storedScene,
    );
    if (!savedSnapshot) {
      continue;
    }

    FirebaseSceneVersionCache.set(socket, storedElements);
    return toBrandedType<RemoteExcalidrawElement[]>([...storedElements]);
  }

  throw new Error("room snapshot save conflict");
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const snapshot = await loadRoomSnapshot(roomId);
  if (!snapshot) {
    return null;
  }
  const elements = getSyncableElements(
    restoreElements(
      await decryptElements(decodeRoomSnapshot(snapshot), roomKey),
      null,
      {
        deleteInvisibleElements: true,
      },
    ),
  );

  if (socket) {
    FirebaseSceneVersionCache.set(socket, elements);
  }

  return elements;
};

export const loadFilesFromFirebase = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        // Self-hosted: download from the local Go backend instead of
        // firebasestorage.googleapis.com (which doesn't exist here).
        const storageHost = import.meta.env.VITE_APP_FIRESTORE_EMULATOR_HOST;
        const base = storageHost
          ? `/v0/b/${FIREBASE_CONFIG.storageBucket}`
          : `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket}`;
        const url = `${base}/o/${encodeURIComponent(
          prefix.replace(/^\//, ""),
        )}%2F${id}`;
        const token = localStorage.getItem("token");
        const response = await fetch(`${url}?alt=media`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (response.status < 400) {
          const arrayBuffer = await response.arrayBuffer();

          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
