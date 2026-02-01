module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-light': '#4A90E2',
        'secondary-light': '#50E3C2',
        'accent-light': '#F5A623',
        'background-light': '#F9F9F9',
        'surface-light': '#FFFFFF',
        'text-primary-light': '#4A4A4A',
        'text-secondary-light': '#9B9B9B',
        'error-light': '#D0021B',

        'primary-dark': '#4A90E2',
        'secondary-dark': '#50E3C2',
        'accent-dark': '#F5A623',
        'background-dark': '#121212',
        'surface-dark': '#1E1E1E',
        'text-primary-dark': '#EAEAEA',
        'text-secondary-dark': '#A5A5A5',
        'error-dark': '#CF6679',
      },
      fontFamily: {
        sans: ['Inter-Regular', 'sans-serif'],
        'inter-bold': ['Inter-Bold', 'sans-serif'],
        'inter-semibold': ['Inter-SemiBold', 'sans-serif'],
        'inter-medium': ['Inter-Medium', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
