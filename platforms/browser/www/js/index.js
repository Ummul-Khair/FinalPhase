 // Packest from the Estimote family (Telemetry, Connectivity, etc.) are
 // broadcast as Service Data (per "§ 1.11. The Service Data - 16 bit UUID" from
 // the BLE spec), with the Service UUID 'fe9a'.
 var ESTIMOTE_SERVICE_UUID = 'fe9a';
 var currentlocationID = "";
 // Once you obtain the "Estimote" Service Data, here's how to check if it's
 // a Telemetry packet, and if so, how to parse it.
 function parseEstimoteTelemetryPacket(data) { // data is a 0-indexed byte array/buffer

     // byte 0, lower 4 bits => frame type, for Telemetry it's always 2 (i.e., 0b0010)
     var frameType = data.readUInt8(0) & 0b00001111;
     var ESTIMOTE_FRAME_TYPE_TELEMETRY = 2;
     if (frameType != ESTIMOTE_FRAME_TYPE_TELEMETRY) {
         return;
     }

     // byte 0, upper 4 bits => Telemetry protocol version ("0", "1", "2", etc.)
     var protocolVersion = (data.readUInt8(0) & 0b11110000) >> 4;
     // this parser only understands version up to 2
     // (but at the time of this commit, there's no 3 or higher anyway :wink:)
     if (protocolVersion > 2) {
         return;
     }

     // bytes 1, 2, 3, 4, 5, 6, 7, 8 => first half of the identifier of the beacon
     var shortIdentifier = data.toString('hex', 1, 9);

     // byte 9, lower 2 bits => Telemetry subframe type
     // to fit all the telemetry data, we currently use two packets, "A" (i.e., "0")
     // and "B" (i.e., "1")
     var subFrameType = data.readUInt8(9) & 0b00000011;

     var ESTIMOTE_TELEMETRY_SUBFRAME_A = 0;
     var ESTIMOTE_TELEMETRY_SUBFRAME_B = 1;

     // ****************
     // * SUBFRAME "A" *
     // ****************
     if (subFrameType == ESTIMOTE_TELEMETRY_SUBFRAME_A) {


         var errors;
         if (protocolVersion == 2) {
             // in protocol version "2"
             // byte 15, bits 2 & 3
             // bit 2 => firmware error
             // bit 3 => clock error (likely, in beacons without Real-Time Clock, e.g.,
             //                      Proximity Beacons, the internal clock is out of sync)
             errors = {
                 hasFirmwareError: ((data.readUInt8(15) & 0b00000100) >> 2) == 1,
                 hasClockError: ((data.readUInt8(15) & 0b00001000) >> 3) == 1
             };
         } else if (protocolVersion == 1) {
             // in protocol version "1"
             // byte 16, lower 2 bits
             // bit 0 => firmware error
             // bit 1 => clock error
             errors = {
                 hasFirmwareError: (data.readUInt8(16) & 0b00000001) == 1,
                 hasClockError: ((data.readUInt8(16) & 0b00000010) >> 1) == 1
             };
         } else if (protocolVersion == 0) {
             // in protocol version "0", error codes are in subframe "B" instead
         }

         // ***** ATMOSPHERIC PRESSURE


         return {
             shortIdentifier,
             frameType: 'Estimote Telemetry',
             subFrameType: 'A',
             protocolVersion,
             errors
         };

         // ****************
         // * SUBFRAME "B" *
         // ****************
     } else if (subFrameType == ESTIMOTE_TELEMETRY_SUBFRAME_B) {


         var batteryVoltage =
             (data.readUInt8(18) << 6) |
             ((data.readUInt8(17) & 0b11111100) >> 2);
         if (batteryVoltage == 0b11111111111111) {
             batteryVoltage = undefined;
         }

         // ***** ERROR CODES
         // byte 19, lower 2 bits
         // see subframe A documentation of the error codes
         // starting in protocol version 1, error codes were moved to subframe A,
         // thus, you will only find them in subframe B in Telemetry protocol ver 0
         var errors;
         if (protocolVersion == 0) {
             errors = {
                 hasFirmwareError: (data.readUInt8(19) & 0b00000001) == 1,
                 hasClockError: ((data.readUInt8(19) & 0b00000010) >> 1) == 1
             };
         }

         // ***** BATTERY LEVEL
         // byte 19 => battery level, between 0% and 100%
         // if all bits are set to 1, it means it hasn't been measured yet
         // added in protocol version 1
         var batteryLevel;
         if (protocolVersion >= 1) {
             batteryLevel = data.readUInt8(19);
             if (batteryLevel == 0b11111111) {
                 batteryLevel = undefined;
             }
         }

         return {
             shortIdentifier,
             frameType: 'Estimote Telemetry',
             subFrameType: 'B',
             protocolVersion,
             batteryVoltage,
             batteryLevel,
             errors
         };
     }
 }

 // example how to scan & parse Estimote Telemetry packets with noble

 var noble = require('noble'); //the function of noble is to discover bluetooth devices 

 noble.on('stateChange', function(state) {


     console.log('state has changed', state);
     if (state == 'poweredOn') {
         var serviceUUIDs = [ESTIMOTE_SERVICE_UUID]; // Estimote Service
         var allowDuplicates = true;
         noble.startScanning(serviceUUIDs, allowDuplicates, function(error) { //noble starts scanning for bluetooth devices 
             if (error) {
                 console.log('error starting scanning', error);
             } else {
                 console.log('started scanning');
             }
         });
     }




 });

 noble.on('discover', function(peripheral) { //on discovering device, this function is exectued
     var data = peripheral.advertisement.serviceData.find(function(el) {

         return el.uuid == ESTIMOTE_SERVICE_UUID;

     }).data; //noble retrieved the data contained in device 

     var telemetryPacket = parseEstimoteTelemetryPacket(data); //the data is parsed here to determine if device is a beacon 
     if (telemetryPacket) { //if it is a telemetry packet, we search the ids of the three beacons used in our projects 

         if ((telemetryPacket.shortIdentifier == "b8e19131d67101ab") || (telemetryPacket.shortIdentifier == "8d24a5cdb702ff90") || (telemetryPacket.shortIdentifier == "7587d73366199923")) {
             currentlocationID = telemetryPacket.shortIdentifier; //if the user is close to any one of the beacons, the location is will be updated
             console.log(telemetryPacket);
             getLocationDetails();

         }


     }
 });


var username = "";
 var lik = 0,
     dis = 0; //like and dislike are initialised to 0; 
 var mqtt = require('mqtt');


 var client = mqtt.connect('mqtt://broker.mqttdashboard.com');
 client.on('connect', function() {
     client.subscribe('eb2111/likes', {
         qos: 1
     });
     client.subscribe('eb2111/dislikes', {
         qos: 1
     });
     client.subscribe('libraryic1/likes', {
         qos: 1
     });
     client.subscribe('libraryic1/dislikes', {
         qos: 1
     });
     client.subscribe('verifyuser', {
         qos: 1

     });

 });
 var currentlocationname = "";
 var cur;
 var express = require('express');
 var app = express();
 var MongoClient = require('mongodb').MongoClient; //instance of mongocliient to connect to the database
 var myCollection;

 //like function is called whenever a student likes a location 
 function like(room) {
     var db = MongoClient.connect('mongodb://umm:like@ds121716.mlab.com:21716/likedislike', function(err, db) { //url to mongodatabse is passed here and function connects to the db 
         if (err)
             throw err;
         console.log("connected to the mongoDB !");
         myCollection = db.collection('rooms'); //database returns the room collection from the database 

         var query = {
             name: room
         };

         myCollection.find(query).toArray(function(err, result) {
             if (err) throw err;
             if (result != null) {
                 ress = result[0];
                 //currentlocationname = ress.name;
                 dis = ress.dislikes;
                 lik = ress.likes;
                 lik = lik + 1;
                 console.log(ress.name);
                 var newvalues = {
                     $set: {
                         likes: lik,
                         dislikes: dis
                     }
                 };
                 myCollection.updateOne(query, newvalues, function(err, res) {
                     if (err) throw err;
                     console.log("1 document updated");
                     db.close();
                 });

             }
         });


 


     });
      getStats();
 }


 //getstats gets the likes and dislikes in the specified location from the database and returns it 
 function getStats() {
     var ress;
     var db = MongoClient.connect('mongodb://umm:like@ds121716.mlab.com:21716/likedislike', function(err, db) {
         if (err)
             throw err;
         console.log("connected to the mongoDB !");
         myCollection = db.collection('rooms');


         myCollection.find({}).toArray(function(err, result) {
             if (err) throw err;
             if (result != null) {
             for(i = 0; i<result.length; i++)
              {
                 ress = result[i];
              
                 if (ress.name == 'EB2 111') {
                     client.publish('eb2likes/val', (ress.likes).toString());
                     client.publish('eb2dislikes/val', (ress.dislikes).toString());
                 } else if (ress.name == 'Library IC1') {
                     client.publish('libic1likes/val', (ress.likes).toString());
                     client.publish('libic1dislikes/val', (ress.dislikes).toString());
                 }
                 console.log(ress.name);
               }
             }
         });


     });
 }

 //dislike function is called whenever a student dislikes a location 
 function dislike(room) {
     var ress;
     
     var db = MongoClient.connect('mongodb://umm:like@ds121716.mlab.com:21716/likedislike', function(err, db) {
         if (err)
             throw err;
         console.log("connected to the mongoDB !");
         myCollection = db.collection('rooms');


         var query = {
             name: room
         };

         myCollection.find(query).toArray(function(err, result) {
             if (err) throw err;
             if (result != null) {
                 ress = result[0];
                 //currentlocationname = ress.name;
                 dis = ress.dislikes;
                 lik = ress.likes;
                 // console.log(doc.company.employed);
                 dis = dis + 1;
                 console.log(ress.name);
                 var newvalues = {
                     $set: {
                         likes: lik,
                         dislikes: dis
                     }
                 };


                 myCollection.updateOne(query, newvalues, function(err, res) {
                     if (err) throw err;
                     console.log("1 document updated");

                     db.close();
                 });
                   
             }
         });

     });
      getStats();
 }
function createaccount(user, pass)
{

   var db = MongoClient.connect('mongodb://umm:like@ds121716.mlab.com:21716/likedislike', function(err, db) {
         if (err)
             throw err;
         console.log("connected to the mongoDB !");
         myCollection = db.collection('userauthentication');

         var myobj = { username: user, password: pass};
        
         myCollection.insertOne(myobj, function(err, result) {
             if (err) throw err;
              console.log("new user created");
                //login successful 
             db.close();
         });
     });
}
 var authenticate;
function login(user, pass)
{

   var db = MongoClient.connect('mongodb://umm:like@ds121716.mlab.com:21716/likedislike', function(err, db) {
         if (err)
             throw err;
         console.log("connected to the mongoDB !");
         myCollection = db.collection('userauthentication');

         var query = {
             username: user,
             password: pass
         }; //find location corresponding to beacon's uuid in database 
         myCollection.find(query).toArray(function(err, result) {
             if (err) console.log("sorry user does not exist");
             if (result.length > 0) {
                console.log("user exists");
                username = user;
                 //checker = true;
                 client.publish(authenticate+'/verify', 'true');
                db.close();
                
             }
             else 
                client.publish(authenticate+'/verify','false');
             
            db.close();
            
         });
     });
   console.log('I am here');

}
 //using /location route to send current location of user 
 function getLocationDetails() {

     var db = MongoClient.connect('mongodb://umm:like@ds121716.mlab.com:21716/likedislike', function(err, db) {
         if (err)
             throw err;
         console.log("connected to the mongoDB !");
         myCollection = db.collection('rooms');

         var query = {
             shortIdentifier: currentlocationID
         }; //find location corresponding to beacon's uuid in database 
         myCollection.find(query).toArray(function(err, result) {
             if (err) throw err;
             if (result != null) {
                 var ress = result[0];
                 currentlocationname = ress.name; //save the name of location as current location 
                 if(username != ""){
                  client.publish(username+'/loc', currentlocationname);
                  client.publish(username+'/bindata', ress.image);
                  //console.log(ress.image);
                }
                 console.log(ress.name);
             }
             db.close();
             //return result;
         });
     });

 }

 client.on('message', function(topic, message) {
     // message is Buffer
     console.log(topic.toString());
     if (topic.toString() == 'eb2111/likes') {
         like('EB2 111');
         client.publish('notification', username + ' liked EB2 111  on ' + new Date().toISOString());
     }
     if (topic.toString() == 'eb2111/dislikes') {
         dislike('EB2 111');
         client.publish('notification', username + ' disliked EB2 111  on ' + new Date().toISOString());
     }
     if (topic.toString() == 'libraryic1/dislikes') {
         dislike('Library IC1');
         client.publish('notification', username + ' disliked Library IC1  on ' + new Date().toISOString());
     }
     if (topic.toString() == 'libraryic1/likes') {
         like('Library IC1');
         client.publish('notification', username + ' liked Library IC1  on ' + new Date().toISOString());
     }
     if (topic.toString() == 'verifyuser') {
        authenticate = message.toString();

        var responss = authenticate.split('hgdfhjmfguysg93q7w7queiuoi^%£Y^&I^$££$');
        console.log(responss[0])
        console.log(responss[1]);
        //console.log(login(responss[0], responss[1]));
        login(responss[0], responss[1]);
        


     }

 });

 app.listen(3005); //listen on port 3000