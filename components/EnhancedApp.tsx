'use client';

import React, { useEffect } from "react";
import App from "./App";

export function EnhancedApp() {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.colorScheme = "dark";
    document.documentElement.style.backgroundColor = "#212121";
    document.body.style.backgroundColor = "#212121";
  }, []);

  return <App />;
}

export default EnhancedApp;
