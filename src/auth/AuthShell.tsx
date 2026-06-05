import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import { KeyRound, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export type AppIdentity = {
  userId: string;
  displayName: string;
  email?: string;
  authMode: "test" | "workos" | "password";
};

type AuthShellProps = {
  children: (identity: AppIdentity) => ReactNode;
};

const authMode = (import.meta.env.VITE_AUTH_MODE ?? "test") as "test" | "workos";
const workosClientId = import.meta.env.VITE_WORKOS_CLIENT_ID as string | undefined;
const workosApiHostname = import.meta.env.VITE_WORKOS_API_HOSTNAME as string | undefined;
const workosDevMode = import.meta.env.VITE_WORKOS_DEV_MODE !== "false";
const workosRedirectUri = import.meta.env.VITE_WORKOS_REDIRECT_URI || window.location.origin;
const testModeStorageKey = "maff-keian-auth-test-mode";

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
  const endTestMode = () => {
    window.localStorage.removeItem(testModeStorageKey);
    window.location.reload();
  };
  return (
    <>
      <div className="auth-banner test">
        <ShieldCheck size={18} />
        <span>テストモード: ログインなしで下書き保存できます</span>
        {authMode === "workos" ? (
          <button className="text-button" type="button" onClick={endTestMode}>
            <LogOut size={16} />
            テスト終了
          </button>
        ) : null}
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
  const [useTestMode, setUseTestMode] = useState(() => window.localStorage.getItem(testModeStorageKey) === "1");
  const [passwordIdentity, setPasswordIdentity] = useState<AppIdentity | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (useTestMode) return;
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
  }, [signIn, signUp, useTestMode]);

  if (useTestMode) {
    return <TestAuth>{children}</TestAuth>;
  }

  if (passwordIdentity) {
    return (
      <>
        <div className="auth-banner password">
          <KeyRound size={18} />
          <span>ID/パスワード認証: {passwordIdentity.displayName}</span>
        </div>
        {children(passwordIdentity)}
      </>
    );
  }

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
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (loginId === "keian" && password === "keian") {
                setAuthError(null);
                setPasswordIdentity({
                  userId: "password-keian",
                  displayName: "keian",
                  email: "keian@example.local",
                  authMode: "password",
                });
                return;
              }
              setAuthError("IDまたはパスワードが違います。ID/パスワードは keian です。");
            }}
          >
            <label className="auth-field">
              <span>ID</span>
              <input value={loginId} autoComplete="username" onChange={(event) => setLoginId(event.target.value)} />
            </label>
            <label className="auth-field">
              <span>パスワード</span>
              <input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button className="primary-button" type="submit">
              <KeyRound size={18} />
              ID/パスワードでログイン
            </button>
          </form>
          <button
            type="button"
            className="ghost-button"
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
            type="button"
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
          {workosDevMode ? (
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                window.localStorage.setItem(testModeStorageKey, "1");
                setAuthError(null);
                setUseTestMode(true);
                window.history.replaceState({}, document.title, window.location.origin);
              }}
            >
              <ShieldCheck size={18} />
              ログインなしでテスト利用
            </button>
          ) : null}
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
