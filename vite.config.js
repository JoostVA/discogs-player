import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When building in GitHub Actions, GITHUB_REPOSITORY is set to "user/repo-name".
// We extract the repo name so asset paths work under /repo-name/ on GitHub Pages.
// Locally it falls back to '/' so dev still works normally.
const base = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  : '/'

export default defineConfig({
  plugins: [react()],
  base,
})
