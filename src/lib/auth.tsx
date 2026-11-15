import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getUser,
  handleAuthCallback,
  onAuthChange,
  logout,
  type User,
} from "@netlify/identity";
import { AuthPage } from "@/pages/Auth";

const AuthContext = createContext<{
  user: User;
  signOut: () => Promise<void>;
} | null>(null);
// eslint-disable-next-line react-refresh/only-export-components
export function useAccount() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Account is required");
  return value;
}
export function AccountGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthChange((event, next) => {
      if (!active) return;
      if (event === "recovery") setRecovery(true);
      setUser(next);
    });
    void (async () => {
      try {
        const callback = await handleAuthCallback();
        const current = await getUser();
        if (active) {
          setUser(current);
          if (callback?.type === "recovery") setRecovery(true);
        }
      } catch {
        if (active)
          setError(
            "This email link is invalid or expired. Request a new link or sign in again.",
          );
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  async function signOut() {
    await logout();
    setUser(null);
  }
  if (!ready)
    return (
      <div
        className="flex min-h-screen items-center justify-center text-muted-foreground"
        role="status"
      >
        Opening your account…
      </div>
    );
  if (!user || recovery)
    return (
      <AuthPage
        recovery={recovery}
        initialError={error}
        onComplete={async () => {
          setUser(await getUser());
          setRecovery(false);
          setError("");
        }}
      />
    );
  return (
    <AuthContext.Provider value={{ user, signOut }}>
      <div key={user.id}>{children}</div>
    </AuthContext.Provider>
  );
}
