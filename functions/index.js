const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

exports.onCapacityChanged = functions.database
  .ref("/bins/{bin}")
  .onUpdate(async (change, context) => {
    const before = change.before.val();
    const after = change.after.val();

    if (before.capacity === after.capacity) {
      console.log("Capacity didn't change");
      return null;
    }

    const binName = after.name;
    let timeEdited = Date.now();

    if (
      after.capacity > after.maxCapacity * (75 / 100) &&
      after.capacity <= after.maxCapacity
    ) {
      const title = "Bin has reached max capacity";
      const content = `The bin at ${binName} has reached max capacity, please collect the waste.`;

      // Get the list of device tokens.
      const tokens = [];

      const db = admin.firestore();
      const tokenRef = db.collection("fcmTokens");
      await tokenRef
        .get()
        .then((snapshot) => {
          snapshot.forEach((doc) => {
            tokens.push(doc.id);
          });
        })
        .catch((err) => {
          console.log("Error getting documents", err);
        });

      if (tokens.length > 0) {
        // Send notifications to all tokens.
        const payload = {
          tokens: tokens,
          notification: {
            title: title,
            body: content,
          },
        };

        await admin
          .messaging()
          .sendEachForMulticast(payload)
          .then((response) => {
            // Response is a message ID string.
            console.log("Successfully sent message:", response);
          })
          .catch((error) => {
            console.log("Tokens:", tokens);
            console.log("Error sending message:", error);
          });
      }

      // Write notification messages to Firestore
      await admin
        .firestore()
        .collection("notifications")
        .add({
          title: title,
          content: content,
          timestamp: timeEdited,
        })
        .then((docRef) => {
          console.log("Document written with ID: ", docRef.id);
        })
        .catch((error) => {
          console.error("Error adding document: ", error);
        });

    }

    return change.after.ref.update({ timeEdited });
  });
