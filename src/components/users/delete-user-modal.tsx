"use client";

import { useState } from "react";
import { GlassModal } from "@/components/ui/glass-modal";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassButton } from "@/components/ui/glass-button";
import { useDeleteUser } from "@/hooks/use-users";

interface DeleteUserModalProps {
  user: { id: string; username: string } | null;
  onClose: () => void;
}

// Deleting a user asks for the signed-in owner's own password (AUDIT.md F-18).
export function DeleteUserModal({ user, onClose }: DeleteUserModalProps) {
  const deleteUser = useDeleteUser();
  const [currentPassword, setCurrentPassword] = useState("");

  const close = () => {
    setCurrentPassword("");
    onClose();
  };

  return (
    <GlassModal
      open={!!user}
      onOpenChange={(open) => !open && close()}
      title="Delete User"
      description={user ? `Delete "${user.username}"? This can't be undone.` : undefined}
      size="sm"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (user) deleteUser.mutate({ id: user.id, currentPassword }, { onSuccess: close });
        }}
      >
        <GlassInput
          label="Your current password *"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <GlassButton type="button" variant="secondary" onClick={close}>
            Cancel
          </GlassButton>
          <GlassButton type="submit" variant="danger" loading={deleteUser.isPending}>
            Delete
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  );
}
