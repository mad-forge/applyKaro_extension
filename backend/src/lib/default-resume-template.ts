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
    {\Huge \textbf{Shashwat}} \\ \vspace{2pt}
    \small Muzaffarpur, Bihar $|$ Phone: +91-8002664676 $|$ Email: \href{mailto:shashwat11muz@gmail.com}{\underline{shashwat11muz@gmail.com}} \\ \vspace{2pt}
    GitHub: \href{https://github.com/mad-forge}{\underline{github.com/mad-forge}} $|$ LinkedIn: \href{https://linkedin.com/in/shashwat8w00}{\underline{linkedin.com/in/shashwat8w00}} $|$ Portfolio: \href{https://SHXx.Tech}{\underline{SHXx.Tech}}
\end{center}
\vspace{-6pt}

\section{Summary}
Frontend-focused Software Engineer (SDE I) experienced in developing scalable React applications across multi-tenant SaaS and secure government domains. Skilled at navigating complex codebases, managing global state at scale with Redux Toolkit, and driving frontend performance optimizations. Proven track record of owning feature lifecycles, integrating real-time systems, payment gateways, and working within modern CI/CD pipelines in fast-paced Agile environments.

\section{Skills}
\noindent
\textbf{Languages:} JavaScript (ES6+),Python, SQL, HTML5, CSS3 \\
\textbf{Frontend:} React.js, Redux Toolkit, RTK Query, React Router, Vite, Tailwind CSS \\
\textbf{Backend \& Tools:} Node.js, Express.js, Git, GitHub, Docker, Firebase, REST APIs \\
\textbf{Libraries:} MUI, SCSS Modules, Chart.js, Headless UI, Socket.IO \\
\textbf{Data:} Power BI, Pandas, NumPy, Scikit-learn, Matplotlib

\section{Experience}

\noindent
\textbf{Software Development Engineer I} \hfill Aug 2025 -- Present \\
\textit{Code Bucket Solutions Pvt. Ltd., Patna, India}
\begin{itemize}
    \item Led frontend module development for Xley.AI, a multi-tenant SaaS platform; designed reusable UI components and integrated REST APIs to support robust Role-Based Access Control (RBAC).
    \item Managed global application state using Redux Toolkit and RTK Query, improving load performance through route-level code splitting and React memoization techniques.
    \item Delivered features for WHITE-LIST, a secure government portal, building analytics dashboards and optimizing complex form workflows and API interactions.
    \item Implemented real-time messaging using Socket.IO and collaborated on streamlining CI/CD pipelines via GitHub Actions and Docker environments for faster deployments.
\end{itemize}
\vspace{2pt}

\noindent
\textbf{Software Engineer Intern} \hfill July 2025 -- Aug 2025 \\
\textit{Code Bucket Solutions Pvt. Ltd., Patna, India}
\begin{itemize}
    \item Developed a scalable, component-driven UI library utilized across multiple platforms, ensuring cross-device consistency and accelerating feature delivery speed.
    \item Integrated complex form workflows with centralized API error handling and schema validation, significantly improving data integrity and user experience.
\end{itemize}
\vspace{2pt}

\noindent
\textbf{Frontend Intern} \hfill Apr 2024 -- May 2024 \\
\textit{E Square System \& Technologies Pvt. Ltd., Bhubaneswar, India}
\begin{itemize}
    \item Built responsive, reusable UI components using HTML5, CSS3, and JavaScript, ensuring strict cross-browser compatibility and mobile-first design.
    \item Integrated backend APIs and enhanced overall UI/UX through iterative feedback and testing.
\end{itemize}

\section{Projects}

\noindent
\textbf{InterviewMint – AI Interview Platform} \\
\textit{React.js, Node.js, PostgreSQL, OpenAI API, Redis, BullMQ}
\begin{itemize}
    \item Built a full-stack AI interview platform supporting technical, behavioral, and machine coding interviews with an adaptive, multi-judge evaluation system.
    \item Engineered scalable backend architecture utilizing Node.js and PostgreSQL; implemented Redis caching and background job processing (BullMQ) to optimize performance.
    \item Developed real-time voice interactions and robust analytics dashboards to track user conversion events and interview progress.
\end{itemize}

\section{Certifications}
\begin{itemize}
    \item Google Data Analytics Professional Certificate – Coursera
    \item SQL Intermediate and Problem Solving – HackerRank
    \item Responsive Web Design Certification – freeCodeCamp
\end{itemize}

\section{Education}

\noindent
\textbf{B.Tech in Computer Science and Engineering} \hfill 2021 -- 2025 \\
\textit{Kalinga Institute of Industrial Technology, Bhubaneswar}

\vspace{2pt}
\noindent
\textbf{12th Science} \hfill 2021 \\
\textit{Inter College Zilla School}

\end{document}
`
