const admin = require('firebase-admin');  
  
// Inicializar Firebase Admin solo una vez  
if (!admin.apps.length) {  
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);  
  admin.initializeApp({  
    credential: admin.credential.cert(serviceAccount),  
    databaseURL: process.env.FIREBASE_DATABASE_URL  
  });  
}
  
exports.handler = async function(event, context) {  
  const headers = {  
    'Access-Control-Allow-Origin': '*',  
    'Access-Control-Allow-Headers': 'Content-Type',  
    'Access-Control-Allow-Methods': 'POST, OPTIONS'  
  };  
  
  if (event.httpMethod === 'OPTIONS') {  
    return {  
      statusCode: 200,  
      headers,  
      body: JSON.stringify({ message: 'Preflight request successful' })  
    };  
  }  
  
  if (event.httpMethod !== 'POST') {  
    return {  
      statusCode: 405,  
      headers,  
      body: JSON.stringify({ message: 'Method not allowed' })  
    };  
  }  
  
  try {  
    const body = JSON.parse(event.body);  
    const { token, title, body: messageBody, data, targetWorkerId } = body;  
  
    // Si hay un trabajador específico, obtener su token  
    let targetToken = token;  
    if (targetWorkerId && !token) {  
      const db = admin.database();  
      const tokenSnapshot = await db.ref(`tokens/${targetWorkerId}`).once('value');  
      if (tokenSnapshot.exists()) {  
        targetToken = tokenSnapshot.val().token;  
      }  
    }  
  
    if (!targetToken) {  
      return {  
        statusCode: 400,  
        headers,  
        body: JSON.stringify({ message: 'Token no encontrado' })  
      };  
    }  
  
    const message = {  
      token: targetToken,  
      notification: {  
        title,  
        body: messageBody  
      },  
      data: data || {},  
      android: {  
        priority: 'high',  
        notification: {  
          sound: 'default',  
          priority: 'high',  
          channelId: 'high_importance_channel'  
        }  
      }  
    };  
  
    const response = await admin.messaging().send(message);  
      
    return {  
      statusCode: 200,  
      headers,  
      body: JSON.stringify({  
        success: true,  
        messageId: response  
      })  
    };  
  
  } catch (error) {  
    console.error('Error al enviar la notificación:', error);  
    return {  
      statusCode: 500,  
      headers,  
      body: JSON.stringify({  
        success: false,  
        error: error.message  
      })  
    };  
  }  
};