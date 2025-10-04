// FILE: src/app/signup/page.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSignup(e) {
        e.preventDefault();
        setErr("");
        setLoading(true);
        const { error } = await supabase.auth.signUp({ email, password });
        setLoading(false);
        if (error) setErr(error.message);
        else {
            router.push("/login"); // After signup, go to login
        }
    }

    return (
        <div className="max-w-md mx-auto p-8 mt-16 bg-white shadow rounded-md">
            <h2 className="text-2xl font-bold mb-6">Sign Up</h2>
            <form onSubmit={handleSignup} className="space-y-4">
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
                    {loading ? "Signing up..." : "Sign Up"}
                </button>
                {err && <div className="text-red-500">{err}</div>}
            </form>
            <div className="text-center pt-4">
                <a href="/login" className="text-indigo-600 hover:underline">Already have an account? Log in</a>
            </div>
        </div>
    );
}
