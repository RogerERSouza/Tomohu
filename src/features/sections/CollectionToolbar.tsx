import { Icon } from '../../components/Icon'
import type { Collection } from './selectCollection'
import type { CollectionControls } from './useCollectionControls'

export function CollectionToolbar({
  isHome,
  collection,
  controls,
  onCreateSection,
  onCreateContent,
}: {
  isHome: boolean
  collection: Collection
  controls: CollectionControls
  onCreateSection: () => void
  onCreateContent: () => void
}) {
  const { isGlobalSearchActive, usedColors, usedTags } = collection
  const {
    query,
    setQuery,
    sortOrder,
    setSortOrder,
    colorFilter,
    setColorFilter,
    tagFilter,
    setTagFilter,
    isSortMenuOpen,
    setIsSortMenuOpen,
    sortMenuRef,
  } = controls
  return (
    <div className="toolbar">
      <label className="search-field">
        <Icon name="search" />
        <input
          type="search"
          aria-label={
            isHome ? 'Pesquisar em todo o Tomohu' : 'Pesquisar nesta seção'
          }
          placeholder={
            isHome ? 'Pesquisar em todo o Tomohu…' : 'Pesquisar nesta seção…'
          }
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {!isGlobalSearchActive && (
        <div className="sort-menu" ref={sortMenuRef}>
          <button
            type="button"
            className="sort-menu-trigger"
            aria-expanded={isSortMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsSortMenuOpen((isOpen) => !isOpen)}
          >
            Ordenar{colorFilter || tagFilter ? ' e filtrar' : ''}
            <Icon name="sort" />
          </button>
          {isSortMenuOpen && (
            <div className="sort-menu-panel" role="menu">
              <span className="sort-menu-label">Ordenar por</span>
              <button
                type="button"
                className={
                  sortOrder === 'newest' ? 'sort-option active' : 'sort-option'
                }
                onClick={() => {
                  setSortOrder('newest')
                  setIsSortMenuOpen(false)
                }}
                aria-pressed={sortOrder === 'newest'}
              >
                Mais recentes
              </button>
              <button
                type="button"
                className={
                  sortOrder === 'oldest' ? 'sort-option active' : 'sort-option'
                }
                onClick={() => {
                  setSortOrder('oldest')
                  setIsSortMenuOpen(false)
                }}
                aria-pressed={sortOrder === 'oldest'}
              >
                Mais antigas
              </button>
              <button
                type="button"
                className={
                  sortOrder === 'alphabetical'
                    ? 'sort-option active'
                    : 'sort-option'
                }
                onClick={() => {
                  setSortOrder('alphabetical')
                  setIsSortMenuOpen(false)
                }}
                aria-pressed={sortOrder === 'alphabetical'}
              >
                A–Z
              </button>
              {usedColors.length > 0 && (
                <>
                  <span className="sort-menu-label">Filtrar por cor</span>
                  <div className="sort-color-options" role="group">
                    <button
                      type="button"
                      className={
                        colorFilter
                          ? 'sort-color-clear'
                          : 'sort-color-clear active'
                      }
                      onClick={() => {
                        setColorFilter(null)
                        setIsSortMenuOpen(false)
                      }}
                    >
                      Todas
                    </button>
                    {usedColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={
                          colorFilter === color
                            ? 'sort-color selected'
                            : 'sort-color'
                        }
                        style={{ backgroundColor: color }}
                        aria-label={`Filtrar pela cor ${color}`}
                        aria-pressed={colorFilter === color}
                        onClick={() => {
                          setColorFilter(color)
                          setIsSortMenuOpen(false)
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
              {usedTags.length > 0 && (
                <>
                  <span className="sort-menu-label">Filtrar por tag</span>
                  <div className="sort-tag-options" role="group">
                    <button
                      type="button"
                      className={tagFilter ? 'sort-tag' : 'sort-tag active'}
                      onClick={() => {
                        setTagFilter(null)
                        setIsSortMenuOpen(false)
                      }}
                    >
                      Todas
                    </button>
                    {usedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={
                          tagFilter === tag ? 'sort-tag active' : 'sort-tag'
                        }
                        onClick={() => {
                          setTagFilter(tag)
                          setIsSortMenuOpen(false)
                        }}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <button className="primary-button" onClick={onCreateSection}>
        <Icon name="plus" />
        <span>{isHome ? 'Nova seção' : 'Subseção'}</span>
      </button>
      {!isHome && (
        <button className="secondary-button" onClick={onCreateContent}>
          <Icon name="plus" />
          Conteúdo
        </button>
      )}
    </div>
  )
}
