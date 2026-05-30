export const DEFAULT_RESUME_LATEX_TEMPLATE = String.raw`\documentclass[a4paper,10pt]{article}

\usepackage[T1]{fontenc}
\usepackage{times}
\usepackage{latexsym}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{titlesec}
\usepackage{geometry}

\geometry{top=0.3in, bottom=0.3in, left=0.4in, right=0.4in}

\titleformat{\section}{
  \vspace{-5pt}\scshape\raggedright\large\bfseries
}{}{0em}{}[\titlerule \vspace{-5pt}]

\setlist[itemize]{leftmargin=0.15in, itemsep=0pt, parsep=0pt, topsep=1pt, partopsep=0pt}

\begin{document}
\pagestyle{empty}

\begin{center}
    {\Huge \textbf{Alex Morgan}} \\ \vspace{2pt}
    \small New Delhi, India $|$ Phone: +91-9876543210 $|$ Email: \href{mailto:alex.morgan@example.com}{\underline{alex.morgan@example.com}} \\ \vspace{2pt}
    GitHub: \href{https://github.com/alexmorgan-dev}{\underline{github.com/alexmorgan-dev}} $|$ LinkedIn: \href{https://linkedin.com/in/alexmorgan-dev}{\underline{linkedin.com/in/alexmorgan-dev}} $|$ Portfolio: \href{https://alexmorgan.dev}{\underline{alexmorgan.dev}}
\end{center}
\vspace{-6pt}

\section{Summary}
Frontend-focused Software Engineer experienced in building responsive web applications, reusable component systems, and API-driven product workflows. Skilled in React, TypeScript, state management, and performance optimization, with a strong focus on clean UI implementation and reliable delivery in Agile teams.

\section{Skills}
\noindent
\textbf{Languages:} JavaScript, TypeScript, SQL, HTML5, CSS3 \\
\textbf{Frontend:} React.js, Redux Toolkit, React Router, Vite, Tailwind CSS \\
\textbf{Backend \& Tools:} Node.js, Express.js, Git, GitHub, Docker, REST APIs \\
\textbf{Libraries:} MUI, Chart.js, Headless UI, Socket.IO \\
\textbf{Testing:} Jest, React Testing Library, Playwright

\section{Experience}

\noindent
\textbf{Frontend Software Engineer} \hfill Jan 2024 -- Present \\
\textit{Example Technologies, Bengaluru, India}
\begin{itemize}
    \item Built reusable React components and integrated REST APIs for customer-facing dashboards and internal workflow tools.
    \item Improved page load performance using route-level code splitting, memoization, and bundle analysis.
    \item Collaborated with designers, backend engineers, and QA to ship features through sprint planning, code review, and release validation.
    \item Added form validation, error states, and accessibility improvements across high-traffic application flows.
\end{itemize}
\vspace{2pt}

\noindent
\textbf{Software Engineer Intern} \hfill Jun 2023 -- Dec 2023 \\
\textit{Sample Labs, Remote}
\begin{itemize}
    \item Developed responsive UI screens using React, TypeScript, and Tailwind CSS from product requirements and Figma designs.
    \item Wrote unit tests for shared components and documented reusable patterns for the frontend team.
\end{itemize}
\vspace{2pt}

\noindent
\textbf{Web Development Intern} \hfill Jan 2023 -- May 2023 \\
\textit{Demo Digital Studio, Pune, India}
\begin{itemize}
    \item Created mobile-first landing pages and interactive UI sections using HTML, CSS, and JavaScript.
    \item Fixed cross-browser layout issues and supported content updates for client websites.
\end{itemize}

\section{Projects}

\noindent
\textbf{Project Management Dashboard} \\
\textit{React.js, Node.js, PostgreSQL, WebSockets}
\begin{itemize}
    \item Built a full-stack dashboard for tracking tasks, team activity, and project milestones with real-time updates.
    \item Designed API endpoints, database tables, and reusable UI widgets for filtered views and reporting.
\end{itemize}

\noindent
\textbf{E-commerce Product Explorer} \\
\textit{React.js, TypeScript, Tailwind CSS}
\begin{itemize}
    \item Implemented product search, filtering, cart interactions, and responsive layouts for a mock online store.
    \item Added loading, empty, and error states to improve usability across common user journeys.
\end{itemize}

\section{Certifications}
\begin{itemize}
    \item Frontend Development Certificate - Example Academy
    \item JavaScript Algorithms and Data Structures - Sample Learning
    \item SQL Fundamentals - Demo Institute
\end{itemize}

\section{Education}

\noindent
\textbf{B.Tech in Computer Science and Engineering} \hfill 2021 -- 2025 \\
\textit{Example Institute of Technology, India}

\vspace{2pt}
\noindent
\textbf{12th Science} \hfill 2021 \\
\textit{Sample Public School}

\end{document}
`
