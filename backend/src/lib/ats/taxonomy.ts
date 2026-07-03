import type { TaxonomyEntry } from './types';

export const SKILL_TAXONOMY: TaxonomyEntry[] = [
  { canonical: 'JavaScript', aliases: ['javascript', 'js', 'ecmascript', 'es6', 'es6+'], category: 'technology' },
  { canonical: 'TypeScript', aliases: ['typescript', 'ts'], category: 'technology' },
  { canonical: 'HTML5', aliases: ['html5', 'html'], category: 'technology' },
  { canonical: 'CSS3', aliases: ['css3', 'css'], category: 'technology' },
  { canonical: 'React', aliases: ['react', 'react.js', 'react js', 'reactjs'], category: 'framework' },
  { canonical: 'Next.js', aliases: ['next.js', 'next js', 'nextjs'], category: 'framework' },
  { canonical: 'Node.js', aliases: ['node.js', 'node js', 'nodejs', 'node'], category: 'technology' },
  { canonical: 'Redux', aliases: ['redux', 'redux toolkit'], category: 'framework' },
  { canonical: 'Context API', aliases: ['context api', 'react context'], category: 'framework' },
  { canonical: 'Tailwind CSS', aliases: ['tailwind css', 'tailwind'], category: 'framework' },
  { canonical: 'Material UI', aliases: ['material ui', 'mui'], category: 'framework' },
  { canonical: 'Ant Design', aliases: ['ant design', 'antd'], category: 'framework' },
  { canonical: 'REST APIs', aliases: ['rest api', 'rest apis', 'restful api', 'restful apis', 'restful api integration'], category: 'technology' },
  { canonical: 'GraphQL', aliases: ['graphql'], category: 'technology' },
  { canonical: 'Git', aliases: ['git', 'github', 'gitlab', 'version control'], category: 'tool' },
  { canonical: 'Vite', aliases: ['vite'], category: 'tool' },
  { canonical: 'Webpack', aliases: ['webpack'], category: 'tool' },
  { canonical: 'Jest', aliases: ['jest'], category: 'tool' },
  { canonical: 'React Testing Library', aliases: ['react testing library', 'rtl'], category: 'tool' },
  { canonical: 'Cypress', aliases: ['cypress'], category: 'tool' },
  { canonical: 'Postman', aliases: ['postman'], category: 'tool' },
  { canonical: 'Jira', aliases: ['jira', 'jira aio'], category: 'tool' },
  { canonical: 'Agile', aliases: ['agile', 'scrum', 'sprint ceremonies'], category: 'skill' },
  { canonical: 'CI/CD', aliases: ['ci/cd', 'ci cd', 'continuous integration', 'github action', 'github actions'], category: 'tool' },
  { canonical: 'Responsive Design', aliases: ['responsive design', 'responsive ui', 'responsive web applications'], category: 'skill' },
  { canonical: 'UI/UX', aliases: ['ui/ux', 'ui ux', 'user experience', 'user interface'], category: 'skill' },
  { canonical: 'Async Programming', aliases: ['asynchronous programming', 'async programming', 'async/await', 'promises'], category: 'skill' },
  { canonical: 'Accessibility', aliases: ['accessibility', 'a11y', 'wcag'], category: 'skill' },
  { canonical: 'Performance Optimization', aliases: ['performance optimization', 'web performance', 'high-performance'], category: 'skill' },
  { canonical: 'Problem Solving', aliases: ['problem solving', 'problem-solving'], category: 'soft-skill' },
  { canonical: 'Communication', aliases: ['communication', 'collaboration', 'cross-functional'], category: 'soft-skill' },
];

export const EDUCATION_TERMS = [
  'bachelor', 'bachelor’s', 'bachelors', 'b.tech', 'btech', 'bca', 'computer science',
  'engineering degree', 'master', 'mca', 'degree',
];

export const PREFERRED_MARKERS = [
  'preferred', 'good to have', 'nice to have', 'bonus', 'plus', 'exposure to', 'familiarity with',
];

export const REQUIRED_MARKERS = [
  'required', 'must have', 'strong knowledge', 'strong understanding', 'experience with',
  'proficient', 'proficiency', 'demonstrated experience',
];
