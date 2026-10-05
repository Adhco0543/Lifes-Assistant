'use client';

import React, { useEffect } from "react";
import App from "./App";

interface EnhancedAppProps {
  userId: string;
}

export function EnhancedApp({ userId }: EnhancedAppProps) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.colorScheme = "dark";
    document.documentElement.style.backgroundColor = "#212121";
    document.body.style.backgroundColor = "#212121";
  }, []);

  return <App userId={userId} />;
}

export default EnhancedApp;
