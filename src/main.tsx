import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexApp } from "./ConvexApp";
import { LocalApp } from "./LocalApp";
import { AuthShell } from "./auth/AuthShell";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthShell>
      {(identity) =>
        convexUrl ? (
          <ConvexProvider client={new ConvexReactClient(convexUrl)}>
            <ConvexApp identity={identity} />
          </ConvexProvider>
        ) : (
          <LocalApp identity={identity} />
        )
      }
    </AuthShell>
  </React.StrictMode>,
);
