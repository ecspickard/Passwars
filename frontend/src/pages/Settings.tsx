import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeading } from "../components/PageHeading";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast";
import { api, ApiError } from "../lib/api";
import { updateProfile, deleteAccount } from "../lib/profile";
import { ChessLinkSection } from "../components/ChessLinkSection";

export default function Settings() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Edit form state
  const [editUsername, setEditUsername] = useState(user?.username ?? "");
  const [editEmail, setEditEmail] = useState(user?.email ?? "");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Track if changes were made
  const profileChanged = useMemo(
    () => editUsername !== user?.username || editEmail !== user?.email,
    [editUsername, editEmail, user?.username, user?.email],
  );

  if (!user) return null;

  const handleSaveProfile = async () => {
    setIsEditingProfile(true);
    setEditError(null);

    try {
      const updates: { username?: string; email?: string } = {};
      if (editUsername !== user.username) updates.username = editUsername;
      if (editEmail !== user.email) updates.email = editEmail;

      await updateProfile(updates);
      await refreshUser();
      showToast("Profile updated successfully", "success");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update profile";
      setEditError(message);
      showToast(message, "error");
    } finally {
      setIsEditingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    setEditUsername(user.username);
    setEditEmail(user.email);
    setEditError(null);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setDeleteError("Please enter your password");
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      await deleteAccount(deletePassword);
      showToast("Account deleted", "success");
      logout();
      navigate("/login");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete account";
      setDeleteError(message);
      showToast(message, "error");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div>
      <PageHeading
        title="Settings"
        description="Manage your account and preferences"
      />

      {/* Profile Section */}
      <div className="mb-8">
        <div className="panel mb-4 p-6">
          <h2 className="mb-4 text-lg font-display text-parchment-50">Account Information</h2>

          <div className="mb-4 space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-steel-300">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                disabled={isEditingProfile}
                className="input-field w-full max-w-sm"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-steel-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                disabled={isEditingProfile}
                className="input-field w-full max-w-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-steel-300">Member Since</label>
              <p className="text-sm text-steel-400">
                {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {editError && (
            <div className="mb-4 rounded-panel border border-signal-500/40 bg-signal-500/10 p-3 text-sm text-signal-400">
              {editError}
            </div>
          )}

          {profileChanged && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isEditingProfile}
                className="btn-gold"
              >
                {isEditingProfile ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isEditingProfile}
                className="btn-ghost"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chess Link Section */}
      <div className="mb-8">
        <ChessLinkSection />
      </div>

      {/* Danger Zone */}
      <div className="mb-8">
        <div className="panel border-signal-500/30 p-6">
          <h2 className="mb-2 text-lg font-display text-signal-400">Danger Zone</h2>
          <p className="mb-4 text-sm text-steel-400">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>

          <button
            type="button"
            onClick={() => {
              setShowDeleteConfirm(true);
              setDeletePassword("");
              setDeleteError(null);
            }}
            className="btn-signal"
            disabled={showDeleteConfirm}
          >
            Delete Account
          </button>

          {showDeleteConfirm && (
            <div className="mt-4 rounded-panel border border-signal-500/40 bg-signal-500/10 p-4">
              <p className="mb-3 text-sm text-parchment-100">
                This will permanently delete your account, all password offerings, collected passwords, and
                challenge history. Type your password to confirm.
              </p>

              <div className="mb-3">
                <input
                  type="password"
                  placeholder="Enter your password to confirm"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  disabled={isDeletingAccount}
                  autoFocus
                  className="input-field w-full max-w-sm"
                />
              </div>

              {deleteError && (
                <div className="mb-3 text-sm text-signal-400">{deleteError}</div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || !deletePassword.trim()}
                  className="btn-signal"
                >
                  {isDeletingAccount ? "Deleting…" : "Permanently Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword("");
                    setDeleteError(null);
                  }}
                  disabled={isDeletingAccount}
                  className="btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
