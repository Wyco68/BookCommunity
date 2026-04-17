import { getInitials } from '../lib/avatar'

interface AvatarProps {
  imageUrl: string | null
  label: string
  size: 'sm' | 'md' | 'lg'
}

export function Avatar({ imageUrl, label, size }: AvatarProps) {
  const className = `avatar avatar-${size}`

  if (imageUrl) {
    return <img className={className} src={imageUrl} alt={`${label} avatar`} />
  }

  return (
    <span className={`${className} avatar-fallback`} aria-hidden="true">
      {getInitials(label)}
    </span>
  )
}
