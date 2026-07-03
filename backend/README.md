This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Test the API without the UI

Add an OpenRouter key to `.env.local` before starting the backend:

```bash
OPENROUTER_API_KEY=your_key_here
```

Put the target job description in `job-description.txt`, then generate and download a
tailored resume directly:

```bash
curl --fail-with-body -X POST 'http://localhost:3000/api/tailor?download=1' \
  -F 'resume=@/absolute/path/to/resume.pdf;type=application/pdf' \
  -F 'jd=<job-description.txt' \
  --output tailored-resume.pdf
```

To get only the ATS analysis as JSON (no OpenRouter key required), use:

```bash
curl --fail-with-body -X POST 'http://localhost:3000/api/analyze' \
  -F 'resume=@/absolute/path/to/resume.pdf;type=application/pdf' \
  -F 'jd=<job-description.txt'
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
