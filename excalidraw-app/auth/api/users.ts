import type { UserProfile, UpdateProfileDto } from "./types";
import {
  getCurrentUser,
  updateProfileApi,
  uploadAvatarApi,
  deleteAvatarApi,
} from "../authApi";

function toProfile(u: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}): UserProfile {
  const now = new Date().toISOString();
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getUserProfile(): Promise<UserProfile> {
  const u = await getCurrentUser();
  if (!u) {
    throw new Error("Not authenticated");
  }
  return toProfile(u);
}

export async function updateUserProfile(
  data: UpdateProfileDto,
): Promise<UserProfile> {
  const u = await updateProfileApi({ name: data.name });
  return toProfile(u);
}

export async function uploadAvatar(file: File): Promise<UserProfile> {
  const u = await uploadAvatarApi(file);
  return toProfile(u);
}

export async function deleteAvatar(): Promise<UserProfile> {
  const u = await deleteAvatarApi();
  return toProfile(u);
}
