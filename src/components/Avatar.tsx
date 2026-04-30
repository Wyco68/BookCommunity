import { getInitials } from '../lib/avatar'

interface AvatarProps {
  imageUrl: string | null
  label: string
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  style?: React.CSSProperties
}

export function Avatar({ imageUrl, label, size, style }: AvatarProps) {
  const className = `avatar avatar-${size}`

  if (imageUrl) {
    return (
      <img
        className={className}
        src={imageUrl}
        alt={`${label} avatar`}
        style={style}
      />
    )
  }

  return (
    <span
      className={`${className} avatar-fallback`}
      aria-hidden="true"
      style={style}
    >
      {getInitials(label)}
    </span>
  )
}
