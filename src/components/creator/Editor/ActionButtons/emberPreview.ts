/** localStorage key that, set to "1", shows the development-only "Ver desafío - Ember" button. */
export const EMBER_FLAG_KEY = 'PB_SHOW_EMBER'

export type EmberSignals = {
    isProduction: boolean
    /** window.location.search (before the #) */
    search: string
    /** window.location.hash: with HashRouter the query can also live after the # ("#/creador/editar?ember=1") */
    hash: string
    storedFlag: string | null
}

const hasEmberParam = (query: string) => new URLSearchParams(query).get('ember') === '1'

/**
 * The Ember preview button is hidden by default. It shows only outside production and with an explicit
 * development signal: ?ember=1 in the URL (before or after the #) or localStorage PB_SHOW_EMBER = "1".
 */
export const shouldShowEmberPreview = ({ isProduction, search, hash, storedFlag }: EmberSignals): boolean => {
    if (isProduction) return false
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?')) : ''
    return hasEmberParam(search) || hasEmberParam(hashQuery) || storedFlag === '1'
}

const readStoredFlag = (): string | null => {
    try {
        return window.localStorage.getItem(EMBER_FLAG_KEY)
    } catch {
        return null
    }
}

export const currentEmberSignals = (): EmberSignals => ({
    isProduction: process.env.NODE_ENV === 'production',
    search: window.location.search,
    hash: window.location.hash,
    storedFlag: readStoredFlag()
})
