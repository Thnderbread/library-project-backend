const allowedOrigins = [
    'http://10.0.0.189:3000',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://library-project-frontend.vercel.app/',
    'http://library-project-frontend-bobbys-projects-c7bd377b.vercel.app/',
    'http://library-project-frontend-git-main-bobbys-projects-c7bd377b.vercel.app/',
];

const allowedMethods = ['GET', 'POST', 'DELETE']

module.exports = { allowedOrigins, allowedMethods };