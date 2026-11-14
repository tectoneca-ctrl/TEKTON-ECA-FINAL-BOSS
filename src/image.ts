/** Center-crops an image to a square and shrinks it to a small JPEG data URL (fits in localStorage; a backend would store the file instead). */
export async function toAvatar(file: File, size = 256): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP image.')
  if (file.size > 8 * 1024 * 1024) throw new Error('That image is larger than 8 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('Could not read that image.'))
      i.src = url
    })
    const s = Math.min(img.width, img.height)
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')
    if (!g) throw new Error('Image processing is not available in this browser.')
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
    return c.toDataURL('image/jpeg', 0.86)
  } finally { URL.revokeObjectURL(url) }
}
