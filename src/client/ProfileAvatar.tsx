import type { PublicUser } from "../shared/contracts";

export function ProfileAvatar({ user, size = 72, className = "" }: { user: Pick<PublicUser, "displayName" | "avatarImageData">; size?: number; className?: string }) {
  return <span className={`profile-avatar ${className}`} style={{ width: size, height: size }} aria-label={`รูปโปรไฟล์ของ ${user.displayName}`}>
    {user.avatarImageData ? <img src={user.avatarImageData} alt="" /> : <span aria-hidden="true">{user.displayName.trim().charAt(0) || "?"}</span>}
  </span>;
}
