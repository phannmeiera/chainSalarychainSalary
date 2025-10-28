export const metadata = {
  title: "chainSalarychainSalary",
  description: "On-chain payroll with privacy-first FHE integrations",
};

import "./globals.css";
import React from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


