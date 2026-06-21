require('dotenv').config();
const app = require('./dist/app').default || require('./dist/app');
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});