// FILE: src/app/signup/page.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Mail, Lock, Eye, EyeOff, ArrowRight, UserPlus, CheckCircle } from "lucide-react";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    async function handleSignup(e) {
        e.preventDefault();
        setErr("");
        setLoading(true);
        const { error } = await supabase.auth.signUp({ email, password });
        setLoading(false);
        if (error) setErr(error.message);
        else {
            setSuccess(true);
            setTimeout(() => {
                router.push("/login");
            }, 2000);
        }
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-green-600 rounded-lg mb-4">
                        <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Account Created!
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                        Please check your email to verify your account.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Redirecting to login page...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Main Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-600 rounded-lg mb-4">
                            <UserPlus className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Join LinguaBridge
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">Create your account and start translating</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSignup} className="space-y-6">
                        {/* Email Field */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    placeholder="Enter your email"
                                    onChange={e => setEmail(e.target.value)}
                                    className="input-modern w-full px-4 py-3"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    placeholder="Create a password"
                                    onChange={e => setPassword(e.target.value)}
                                    className="input-modern w-full px-4 pr-12 py-3"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {err && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{err}</p>
                            </div>
                        )}

                        {/* Signup Button */}
                        <button 
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3 text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <p className="text-gray-600 dark:text-gray-300 text-sm">
                            Already have an account?{" "}
                            <a 
                                href="/login" 
                                className="font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                            >
                                Sign in here
                            </a>
                        </p>
                    </div>
                </div>

                {/* Features Card */}
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                        <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-3">What you'll get:</h3>
                        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <div className="flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>AI-powered translations</span>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Document chat assistance</span>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Multi-language support</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
