import app from './app';

const PORT = process.env.PORT || 3000;

app().then((server) => {
  server.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
});
