const app = require('./src/app.js');
// const { conn } = require('./src/db.js');
const port = process.env.PORT || 3002
// Syncing all the models at once.
// conn.sync({ force: true }).then(() => {
  app.listen(port, () => {
    console.log(`%s listening at 3002`); // eslint-disable-line no-console
  });
// });
