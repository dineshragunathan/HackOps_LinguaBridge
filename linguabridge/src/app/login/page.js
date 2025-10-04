// src/pages/Login.js
"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage({ onLoggedIn }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(e) {
        e.preventDefault();
        setErr("");
        setLoading(true);
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) setErr(error.message);
        else {
            if (onLoggedIn) onLoggedIn(data?.session?.user);
            window.location.href = "/"; // redirect to home, or your dashboard
        }
    }

    return (
        <div className="max-w-md mx-auto p-8 mt-16 bg-white shadow rounded-md">
            <h2 className="text-2xl font-bold mb-6">Log In</h2>
            <form onSubmit={handleLogin} className="space-y-4">
                <input
                    type="email"
                    required
                    value={email}
                    placeholder="Email"
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-3 border rounded"
                />
                <input
                    type="password"
                    required
                    value={password}
                    placeholder="Password"
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-3 border rounded"
                />
                <button className="w-full bg-indigo-600 text-white rounded p-3" disabled={loading}>
                    {loading ? "Logging in..." : "Log In"}
                </button>
                <div className="text-center pt-4">
                    <a href="/signup" className="text-indigo-600 hover:underline">Don&apos;t have an account? Sign up</a>
                </div>

                {err && <div className="text-red-500">{err}</div>}
            </form>
        </div>
    );
}
