import { useEffect, useState } from "react"

type Size = { width: number, height: number }

/**
 * Content size of an element, updated when it changes.
 * Returns a ref callback and the size, undefined while it can't be measured (e.g. no ResizeObserver in jsdom).
 */
export const useElementSize = () => {
    const [element, setElement] = useState<Element | null>(null)
    const [size, setSize] = useState<Size>()

    useEffect(() => {
        if (!element || typeof ResizeObserver === 'undefined') return

        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[entries.length - 1].contentRect
            setSize({ width, height })
        })
        observer.observe(element)

        return () => observer.disconnect()
    }, [element])

    return [setElement, size] as const
}
