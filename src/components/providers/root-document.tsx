import { TopLoaderProvider } from "@/components/providers/top-loader-provider"
import { AppProviders } from "@/components/providers/app-providers"
import { SidebarConfigProvider } from "@/contexts/sidebar-context"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { inter } from "@/lib/fonts"

/**
 * The `<html>` document every page renders in. Each root segment renders it
 * with its own language: `[locale]` with the route's locale, so the server
 * HTML already carries the right `lang`, and the wiki and the global 404 with
 * theirs. `src/app/layout.tsx` only passes its children through.
 */
export function RootDocument({
    lang,
    children,
}: {
    lang: string
    children: React.ReactNode
}) {
    return (
        <html
            lang={lang}
            suppressHydrationWarning
            className={`${inter.variable} antialiased`}
            data-scroll-behavior="smooth"
        >
            <body className={inter.className} suppressHydrationWarning>
                <AppProviders>
                    <ThemeProvider
                        defaultTheme="system"
                        storageKey="nextjs-ui-theme"
                    >
                        <TopLoaderProvider />
                        <SidebarConfigProvider>
                            {children}
                        </SidebarConfigProvider>
                        <Toaster />
                    </ThemeProvider>
                </AppProviders>
            </body>
        </html>
    )
}
