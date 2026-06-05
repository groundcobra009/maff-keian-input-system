import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import { LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export type AppIdentity = {
  userId: string;
  displayName: string;
  email?: string;
  authMode: "test" | "workos";
};

type AuthShellProps = {
  children: (identity: AppIdentity) => ReactNode;
};

const authMode = (import.meta.env.VITE_AUTH_MODE ?? "test") as "test" | "workos";
const workosClientId = import.meta.env.VITE_WORKOS_CLIENT_ID as string | undefined;
const workosApiHostname = import.meta.env.VITE_WORKOS_API_HOSTNAME as string | undefined;
const workosDevMode = import.meta.env.VITE_WORKOS_DEV_MODE !== "false";
const workosRedirectUri = import.meta.env.VITE_WORKOS_REDIRECT_URI || window.location.origin;

export function AuthShell({ children }: AuthShellProps) {
  if (authMode !== "workos") {
    return <TestAuth>{children}</TestAuth>;
  }

  if (!workosClientId) {
    return (
      <AuthSetupMissing>
        <p>`VITE_WORKOS_CLIENT_ID` を設定するとWorkOSログインが有効になります。</p>
      </AuthSetupMissing>
    );
  }

  return (
    <AuthKitProvider
      clientId={workosClientId}
      apiHostname={workosApiHostname}
      devMode={workosDevMode}
      redirectUri={workosRedirectUri}
      onRedirectCallback={() => {
        window.history.replaceState({}, document.title, window.location.origin);
      }}
    >
      <WorkosAuth>{children}</WorkosAuth>
    </AuthKitProvider>
  );
}

function TestAuth({ children }: AuthShellProps) {
  return (
    <>
      <div className="auth-banner test">
        <ShieldCheck size={18} />
        <span>テストモード: ログインなしで下書き保存できます</span>
      </div>
      {children({
        userId: "test-user",
        displayName: "テスト利用者",
        authMode: "test",
      })}
    </>
  );
}

function WorkosAuth({ children }: AuthShellProps) {
  const { isLoading, user, signIn, signUp, signOut } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.pathname === "/login") {
      signIn().catch((error) => {
        setAuthError(error instanceof Error ? error.message : "ログインを開始できませんでした");
      });
    }
    if (window.location.pathname === "/sign-up") {
      signUp().catch((error) => {
        setAuthError(error instanceof Error ? error.message : "新規登録を開始できませんでした");
      });
    }
  }, [signIn, signUp]);

  if (isLoading) {
    return (
      <div className="auth-screen">
        <div className="auth-panel">
          <ShieldCheck size={28} />
          <h1>認証状態を確認しています</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-panel">
          <ShieldCheck size={30} />
          <p className="eyebrow">WorkOS AuthKit</p>
          <h1>経営安定申請入力システム</h1>
          <p>初回は新規登録、登録済みの場合はログインから利用を開始します。</p>
          {authError ? <p className="auth-error">{authError}</p> : null}
          <button
            className="primary-button"
            onClick={() =>
              signUp().catch((error) => {
                setAuthError(error instanceof Error ? error.message : "新規登録を開始できませんでした");
              })
            }
          >
            <LogIn size={18} />
            Googleで新規登録
          </button>
          <button
            className="ghost-button"
            onClick={() =>
              signIn().catch((error) => {
                setAuthError(error instanceof Error ? error.message : "ログインを開始できませんでした");
              })
            }
          >
            <LogIn size={18} />
            登録済みの方はこちら
          </button>
        </div>
      </div>
    );
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "ログイン利用者";

  return (
    <>
      <div className="auth-banner workos">
        <UserRound size={18} />
        <span>{displayName}</span>
        <button className="text-button" onClick={() => signOut()}>
          <LogOut size={16} />
          ログアウト
        </button>
      </div>
      {children({
        userId: user.id,
        displayName,
        email: user.email,
        authMode: "workos",
      })}
    </>
  );
}

function AuthSetupMissing({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <ShieldCheck size={30} />
        <p className="eyebrow">WorkOS AuthKit</p>
        <h1>環境変数が未設定です</h1>
        {children}
      </div>
    </div>
  );
}
