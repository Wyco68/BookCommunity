import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, CategoryMember, CategoryVisibility } from '../../types'
import { Avatar } from '../Avatar'

interface CategoryListProps {
  categories: Category[]
  categoryMembers: Record<string, CategoryMember>
  selectedCategoryId: string | null
  onSelectCategory: (id: string) => void
  onJoinCategory: (id: string) => Promise<void>
  onLeaveCategory: (id: string) => Promise<void>
  busyCategoryId: string | null
}

export function CategoryList({
  categories,
  categoryMembers,
  selectedCategoryId,
  onSelectCategory,
  onJoinCategory,
  onLeaveCategory,
  busyCategoryId,
}: CategoryListProps) {
  return (
    <ul className="session-list">
      {categories.map((category) => {
        const membership = categoryMembers[category.id]
        const isSelected = selectedCategoryId === category.id

        return (
          <li
            key={category.id}
            className={`session-item ${isSelected ? 'session-item-selected' : ''}`}
          >
            <div className="stack gap-sm">
              <div className="session-heading">
                <h3>{category.name}</h3>
                <span className="pill">{category.visibility}</span>
              </div>

              {category.description ? (
                <p className="muted">{category.description}</p>
              ) : null}

              <button
                type="button"
                className="tertiary"
                onClick={() => onSelectCategory(category.id)}
              >
                {isSelected ? 'Viewing' : 'View Details'}
              </button>

              {membership ? (
                <div className="split compact">
                  <span className="pill">{membership.role}</span>
                  {membership.role !== 'owner' ? (
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={busyCategoryId === category.id}
                      onClick={() => { void onLeaveCategory(category.id) }}
                    >
                      {busyCategoryId === category.id ? 'Leaving…' : 'Leave'}
                    </button>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  className="secondary"
                  disabled={busyCategoryId === category.id}
                  onClick={() => { void onJoinCategory(category.id) }}
                >
                  {busyCategoryId === category.id ? 'Joining…' : 'Join Category'}
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

interface CreateCategoryFormProps {
  onCreateCategory: (name: string, description: string, visibility: CategoryVisibility) => Promise<Category | null>
  creating: boolean
}

export function CreateCategoryForm({ onCreateCategory, creating }: CreateCategoryFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<CategoryVisibility>('public')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return

    const result = await onCreateCategory(name, description, visibility)
    if (result) {
      setName('')
      setDescription('')
      setVisibility('public')
    }
  }

  return (
    <form className="stack" onSubmit={(e) => { void handleSubmit(e) }}>
      <label className="field">
        <span>Category Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sci-Fi Book Club"
          maxLength={100}
        />
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this category about?"
        />
      </label>

      <label className="field">
        <span>Visibility</span>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as CategoryVisibility)}
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </label>

      <button type="submit" className="primary" disabled={creating || !name.trim()}>
        {creating ? 'Creating…' : 'Create Category'}
      </button>
    </form>
  )
}

interface CategoryDetailProps {
  category: Category | null
  members: CategoryMember[]
  profiles: Record<string, { id: string; display_name: string | null; avatar_url: string | null }>
  isMember: boolean
  isOwner: boolean
  sessionCount: number
}

export function CategoryDetail({
  category,
  members,
  profiles,
  isMember,
  isOwner,
  sessionCount,
}: CategoryDetailProps) {
  if (!category) {
    return (
      <article className="card stack">
        <p className="subtle">Select a category to view details.</p>
      </article>
    )
  }

  return (
    <article className="card stack">
      <div className="detail-header">
        <div>
          <h2>{category.name}</h2>
          <p className="subtle">{category.description || 'No description'}</p>
        </div>
        <div className="split compact">
          <span className="pill">{category.visibility}</span>
          {isOwner ? <span className="pill">Owner</span> : null}
          {isMember && !isOwner ? <span className="pill">Member</span> : null}
        </div>
      </div>

      <div className="detail-grid">
        <section className="detail-pane stack">
          <h3>Members ({members.length})</h3>
          <ul className="member-list">
            {members.map((member) => {
              const profile = profiles[member.user_id]
              return (
                <li key={member.user_id} className="member-item">
                  <div className="member-head">
                    <div className="identity-row">
                      <Avatar
                        imageUrl={profile?.avatar_url ?? null}
                        label={profile?.display_name || member.user_id.slice(0, 8)}
                        size="sm"
                      />
                      <strong>{profile?.display_name || member.user_id.slice(0, 8)}</strong>
                    </div>
                    <span className="pill">{member.role}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="detail-pane stack">
          <h3>Sessions ({sessionCount})</h3>
          <p className="subtle">
            {sessionCount === 0
              ? 'No sessions linked to this category yet.'
              : `${sessionCount} reading session${sessionCount !== 1 ? 's' : ''} in this category.`}
          </p>
        </section>
      </div>
    </article>
  )
}
