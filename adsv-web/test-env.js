exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      apiKey: process.env.FIREBASE_API_KEY || "No se encontró"
    })
  };
};
