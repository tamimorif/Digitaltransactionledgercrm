import React, { useState } from 'react'
import Image from 'next/image'

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg=='

type ImageWithFallbackProps = Omit<React.ComponentProps<typeof Image>, 'src' | 'alt'> & {
  src?: string
  alt?: string
}

export function ImageWithFallback(props: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false)

  const handleError = () => {
    setDidError(true)
  }

  const { src, alt = '', style, className, width, height, fill, ...rest } = props
  const imageSrc = didError || !src ? ERROR_IMG_SRC : src

  if (fill) {
    return (
      <div className={`relative ${className ?? ''}`} style={style}>
        <Image
          {...rest}
          src={imageSrc}
          alt={alt}
          fill
          onError={handleError}
          className="object-contain"
          data-original-url={src}
          unoptimized
        />
      </div>
    )
  }

  const resolvedWidth = typeof width === 'number' ? width : 1
  const resolvedHeight = typeof height === 'number' ? height : 1

  return (
    <Image
      {...rest}
      src={imageSrc}
      alt={alt}
      width={resolvedWidth}
      height={resolvedHeight}
      className={className}
      style={style}
      onError={handleError}
      data-original-url={src}
      unoptimized
    />
  )
}
