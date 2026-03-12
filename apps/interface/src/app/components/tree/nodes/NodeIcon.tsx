import { Plus } from 'lucide-react'

interface NodeIconProps {
  avatarUrl?: string | null
  fallback: React.ReactNode
  accentColor: string
  size?: number
  isSuggested?: boolean
}

function sanitizeAvatarUrl(raw?: string | null): string | null {
  if (!raw) return null
  const url = raw.trim()
  if (!url) return null

  // Allow: absolute URLs, protocol-relative, data URLs.
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('//') ||
    url.startsWith('data:')
  ) {
    return url
  }

  // Disallow relative / scheme-less values (these cause localhost/<...> 404s).
  return null
}

export function NodeIcon({
  avatarUrl,
  fallback,
  accentColor,
  size = 48,
  isSuggested = false,
}: NodeIconProps) {
  const roundedClass = size >= 48 ? 'rounded-lg' : 'rounded-md'

  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl)

  if (safeAvatarUrl && !isSuggested) {
    return (
      <div
        className={`flex items-center justify-center ${roundedClass} flex-shrink-0 overflow-hidden`}
        style={{ width: size, height: size }}
      >
        <img
          src={safeAvatarUrl}
          alt="Node avatar"
          style={{
            width: size,
            height: size,
            objectFit: 'cover',
          }}
        />
      </div>
    )
  }

  const iconSize = Math.round(size * 0.6)

  return (
    <div
      className={`flex items-center justify-center ${roundedClass} flex-shrink-0`}
      style={{
        width: size,
        height: size,
        backgroundColor: isSuggested ? '#e2e8f0' : accentColor,
      }}
    >
      {isSuggested ? (
        <Plus size={iconSize} color="#64748b" strokeWidth={2} />
      ) : (
        fallback
      )}
    </div>
  )
}
