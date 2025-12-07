"use client";

import { useState } from "react";
import { X, Lock, Bell, Palette, Trash2, Loader2, Check, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'password' | 'notifications' | 'appearance'>('password');
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [notifications, setNotifications] = useState({
        email: true,
        approvals: true,
        updates: false
    });
    const supabase = createClient();
    const router = useRouter();

    const handlePasswordChange = async () => {
        if (!newPassword || !confirmPassword) {
            toast.error("Please fill in all password fields");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            toast.success("Password updated successfully");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            console.error("Error updating password:", error);
            toast.error(error.message || "Failed to update password");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'password', label: 'Security', icon: Lock },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'appearance', label: 'Appearance', icon: Palette },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 py-4 px-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === tab.id
                                ? 'text-orange-600 border-orange-500 bg-orange-50'
                                : 'text-slate-400 border-transparent hover:text-slate-600'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeTab === 'password' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                                        placeholder="Enter new password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Confirm New Password</label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                                    placeholder="Confirm new password"
                                />
                            </div>
                            <button
                                onClick={handlePasswordChange}
                                disabled={isLoading || !newPassword || !confirmPassword}
                                className="w-full py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Update Password
                            </button>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-4">
                            <ToggleItem
                                label="Email Notifications"
                                description="Receive important updates via email"
                                checked={notifications.email}
                                onChange={(v) => setNotifications({ ...notifications, email: v })}
                            />
                            <ToggleItem
                                label="Approval Alerts"
                                description="Get notified when your status changes"
                                checked={notifications.approvals}
                                onChange={(v) => setNotifications({ ...notifications, approvals: v })}
                            />
                            <ToggleItem
                                label="Platform Updates"
                                description="News about new features and changes"
                                checked={notifications.updates}
                                onChange={(v) => setNotifications({ ...notifications, updates: v })}
                            />
                            <p className="text-xs text-slate-400 text-center pt-4">
                                Notification preferences are saved automatically
                            </p>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-3">Theme</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <ThemeOption label="Light" active={true} color="bg-white" />
                                    <ThemeOption label="Dark" active={false} color="bg-slate-800" />
                                    <ThemeOption label="System" active={false} color="bg-gradient-to-br from-white to-slate-800" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-xs text-slate-400 text-center">
                                    More appearance options coming soon
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Danger Zone */}
                <div className="p-6 bg-red-50 border-t border-red-100">
                    {!showDeleteConfirm ? (
                        <>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Account
                            </button>
                            <p className="text-xs text-red-400 text-center mt-2">
                                This action cannot be undone
                            </p>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-start gap-3 p-3 bg-red-100 rounded-xl">
                                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-red-900 text-sm">Delete Account Permanently?</p>
                                    <p className="text-xs text-red-700 mt-1">
                                        This will permanently delete your account, all documents, essays, and application data. This action cannot be undone.
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-red-600 block mb-2">
                                    Type DELETE to confirm
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="DELETE"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-red-900"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeleteConfirmText("");
                                    }}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        if (deleteConfirmText !== "DELETE") {
                                            toast.error("Please type DELETE to confirm");
                                            return;
                                        }
                                        setIsDeleting(true);
                                        try {
                                            const { data: { user } } = await supabase.auth.getUser();
                                            if (!user) throw new Error("Not authenticated");

                                            // Delete user data from database
                                            await supabase.from('essays').delete().eq('student_id', user.id);
                                            await supabase.from('documents').delete().eq('student_id', user.id);
                                            await supabase.from('student_universities').delete().eq('student_id', user.id);
                                            await supabase.from('profiles').delete().eq('id', user.id);

                                            // Sign out
                                            await supabase.auth.signOut();

                                            toast.success("Account deleted successfully");
                                            router.push("/");
                                        } catch (error: any) {
                                            console.error("Delete error:", error);
                                            toast.error(error.message || "Failed to delete account");
                                        } finally {
                                            setIsDeleting(false);
                                        }
                                    }}
                                    disabled={deleteConfirmText !== "DELETE" || isDeleting}
                                    className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    Delete Forever
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ToggleItem({ label, description, checked, onChange }: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
                <p className="font-bold text-slate-800">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`w-12 h-7 rounded-full transition-colors ${checked ? 'bg-orange-500' : 'bg-slate-300'}`}
            >
                <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    );
}

function ThemeOption({ label, active, color }: { label: string; active: boolean; color: string }) {
    return (
        <button className={`p-4 rounded-xl border-2 transition-all ${active ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <div className={`w-full h-8 rounded-lg ${color} border border-slate-200 mb-2`} />
            <p className={`text-xs font-bold ${active ? 'text-orange-600' : 'text-slate-500'}`}>{label}</p>
        </button>
    );
}
