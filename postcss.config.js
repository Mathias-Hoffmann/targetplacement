<<<<<<< HEAD
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
=======
// postcss.config.js
import tailwind from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

export default {
  plugins: [tailwind(), autoprefixer()],
}
>>>>>>> 6bbee61 (Ajout de la simulation 3D commentée)
