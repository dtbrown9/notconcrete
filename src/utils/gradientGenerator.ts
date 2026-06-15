/**
 * Generate random CSS gradient backgrounds
 * Creates beautiful, random multi-color gradients for hero sections
 */

type GradientColor = {
  r: number
  g: number
  b: number
}

function generateRandomColor(): GradientColor {
  return {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
  }
}

function colorToString(color: GradientColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

/**
 * Generate a random gradient with 2-4 colors
 * @returns CSS gradient string ready to use as background
 */
export function generateRandomGradient(): string {
  const numColors = Math.floor(Math.random() * 3) + 2 // 2-4 colors
  const colors: string[] = []
  
  for (let i = 0; i < numColors; i++) {
    colors.push(colorToString(generateRandomColor()))
  }
  
  const angle = Math.floor(Math.random() * 360)
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`
}

/**
 * Generate a radial gradient with random colors
 * @returns CSS radial gradient string
 */
export function generateRandomRadialGradient(): string {
  const color1 = colorToString(generateRandomColor())
  const color2 = colorToString(generateRandomColor())
  const color3 = colorToString(generateRandomColor())
  
  return `radial-gradient(circle at ${Math.random() * 100}% ${Math.random() * 100}%, ${color1}, ${color2}, ${color3})`
}

/**
 * Generate a subtle gradient (darker tones) suitable for overlays
 * @returns CSS gradient string with muted colors
 */
export function generateSubtleGradient(): string {
  const hue1 = Math.floor(Math.random() * 360)
  const hue2 = (hue1 + Math.floor(Math.random() * 120)) % 360
  
  const color1 = `hsl(${hue1}, 60%, 45%)`
  const color2 = `hsl(${hue2}, 55%, 50%)`
  
  return `linear-gradient(135deg, ${color1}, ${color2})`
}
