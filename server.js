const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser());
app.use(bodyParser.json({
    limit: '5mb'
}));
app.use(bodyParser.urlencoded({
    extended: true
}));
var ModbusRTU = require("modbus-serial");
const port = process.env.PORT || 3000;
const WeightIoTIpAddress = "103.93.194.58";
const getIoTIpAddress = "103.93.194.58";
const WeightIoTPortNumber = 502;
const getIoTportNumber = 503;
const configuredMergelength = 256 //For encryption merge data
const configuredDecryMergelength = 255 //For decryption merge data
const configuredDividelength = 65536 //For split data in two 


var client = new ModbusRTU();
var GateIoTclient = new ModbusRTU();
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

//@@ Weight IOT Related Activity (All Get And Post Methods)//
ConnectToModbus();
ConnectToGetIotModbus();
app.get('/api/setConnection', (req, res) => {
    client.connectTCP(WeightIoTIpAddress, {
        port: WeightIoTPortNumber
    })
        .then(function () {
            //console.log(res)
            res.send('connected');
        })
        .catch(function (e) {
            if (e.errno) {
                if (networkErrors.includes(e.errno)) {
                    res.status(404).send("we have to reconnect");
                }
            }
            res.status(404).send(e.message);
        });
})

app.get('/api/GetLoadingLayerData', (req, res) => {
    debugger
    if (req.param('loadingId') && req.param('layerId')) {
        var EncryptFirstValue = parseInt(req.param('loadingId') * configuredMergelength) + parseInt(req.param('layerId'));
        client.readHoldingRegisters(EncryptFirstValue, 1)
            .then(function (d) {
                if (d.data.length < 1) {
                    res.status(200).send({
                        msg: 'records not found',
                        code: 0
                    });
                } else {
                    var finalData = [];
                    startIndex = 0;
                    endIndex = 8;
                    for (let index = 0; index < d.data.length / 8; index++) {
                        if (index != 0) {
                            startIndex = endIndex;
                            endIndex = endIndex + 8;
                        }
                        splitData = d.data.slice(startIndex, endIndex);
                        splitData.unshift(EncryptFirstValue);
                        if (splitData.length == 9) {
                            finalData[index] = ConvertInDecryptionData(splitData);
                        }
                    }
                    res.send({
                        msg: 'Record Fetch Successfully',
                        code: 1,
                        data: finalData
                    });
                }
            })
            .catch(function (e) {
                ConnectToModbus();
                res.status(404).send("connection Error Please try again");
            })
    } else {
        res.status(200).send({
            msg: 'Required two parameters',
            code: 0
        });
    }
})

app.get('/api/DeleteCompleteLoading', (req, res) => {
    debugger
    if (req.param('loadingId') && req.param('layerId')) {
        var EncryptFirstValue = parseInt(req.param('loadingId') * configuredMergelength) + parseInt(req.param('layerId'));
        console.log(EncryptFirstValue)
        client.readHoldingRegisters(EncryptFirstValue, 2)
            .then(function (d) {
                if (d.data.length == 1 && d.data[0] == '3142') {
                    res.status(200).send({
                        msg: 'All Data Deleted',
                        code: 1,
                        data: []
                    });
                    //res.status(200).send("Delete Complete Loading Info");
                } else {
                    res.status(200).send({
                        msg: 'somthing wends to wrong please try again',
                        code: 0,
                        data: []
                    });
                    //res.status(404).send("somthing wends to wrong please try again");
                }
            })
            .catch(function (e) {
                ConnectToModbus();
                res.status(404).send("Error in read Holding Registers");
            })
    } else {
        res.status(200).send({
            msg: 'Required two parameters',
            code: 0,
            data: []
        });
        //res.status(404).send("Required two parameters");
    }
})

app.get('/api/CompleteClear', (req, res) => {
    debugger
    client.readHoldingRegisters(0, 3)
        .then(function (d) {
            if (d.data.length == 1 && d.data[0] == '2413') {
                res.status(200).send({
                    msg: 'Truncate All Data',
                    code: 1,
                    data: []
                });
                //res.status(200).send("Truncate All Data");
            } else {
                res.status(200).send({
                    msg: 'somthing wents to wrong please try again',
                    code: 0,
                    data: []
                });
                //res.status(404).send("somthing wents to wrong please try again");
            }
        })
        .catch(function (e) {
            ConnectToModbus();
            res.status(404).send("connection Error Please try again");
        })
})

app.get('/api/ReadWeight', (req, res) => {
    debugger
    client.readHoldingRegisters(0, 4)
        .then(function (d) {
            console.log(d)
            var firstValue = d.data[0] * configuredDividelength;
            var secValue = d.data[1] + firstValue;
            res.status(200).send(JSON.stringify(secValue));
        })
        .catch(function (e) {
            ConnectToModbus();
            res.status(404).send("WriteCommand: connection Error Please try again");
        })
})

app.post('/api/WriteCommand', (req, res) => {
    //console.log(ConvertInEncryptionData(req.body.data))
    if (req.body.data != null && req.body.data != undefined) {
        if (req.body.data.length == 9) {
            client.writeRegisters(11, ConvertInEncryptionData(req.body.data))
                .then(function (writeData) {
                    if (writeData != null && writeData != undefined) {
                        if (writeData.address == 11 && writeData.length == 9) {
                            res.status(200).send({
                                msg: 'Save Successfully',
                                code: 1
                            });
                        } else {
                            res.status(404).send('WriteCommand: Error when data write on divice');
                        }
                    }
                })
                .catch(function (e) {
                    ConnectToModbus();
                    res.status(404).send(e.message);
                })
        } else {
            res.status(404).send("WriteCommand : Data length error when encrypt data");
        }
    } else {
        res.status(404).send("WriteCommand: Please check all parametres");
    }
})

function ConnectToModbus() {
    client.connectTCP(WeightIoTIpAddress, {
        port: WeightIoTPortNumber
    })
        .then(function () {
            console.log("weight IoT connected");
        })
}

function ConvertInEncryptionData(data) {
    debugger
    var EncryptMergeArray = [];
    try {
        var EncryptFirstValue = (data[0] * configuredMergelength) + data[1];
        EncryptMergeArray.push(EncryptFirstValue);
        var EncryptSecValue = (data[2] * configuredMergelength) + data[3];
        EncryptMergeArray.push(EncryptSecValue);
        var EncryptThirdValue = Math.floor(data[4] / configuredDividelength);
        EncryptMergeArray.push(EncryptThirdValue);
        var EncryptFourthValue = data[4] % configuredDividelength;
        EncryptMergeArray.push(EncryptFourthValue);
        EncryptMergeArray.push(data[5]);
        EncryptMergeArray.push(data[6]);
        var EncryptFifthValue = Math.floor(data[7] / configuredDividelength);
        EncryptMergeArray.push(EncryptFifthValue);
        var EncryptSixthValue = data[7] % configuredDividelength;
        EncryptMergeArray.push(EncryptSixthValue);
        EncryptMergeArray.push(data[8]);
        return EncryptMergeArray;
    } catch (error) {
        console.log("Error In ConvertInEncryptionData" + error);
        return null;
    }
}

function ConvertInDecryptionData(data) {

    var DycriptMergeArray = [];
    try {
        var DycryptFirstValue = Math.floor(data[0] / configuredMergelength);
        DycriptMergeArray.push(DycryptFirstValue);
        var DycryptSecValue = data[0] & configuredDecryMergelength;
        DycriptMergeArray.push(DycryptSecValue);
        //--------------------------------------------------
        var DycryptThirdValue = Math.floor(data[1] / configuredMergelength);
        DycriptMergeArray.push(DycryptThirdValue);
        var DycryptFourthValue = data[1] & configuredDecryMergelength;
        DycriptMergeArray.push(DycryptFourthValue);
        //---------------------------------------------------------
        var DycryptFifthValue = data[2] * configuredDividelength;
        //DycriptMergeArray.push(DycryptFifthValue);
        var DycryptSixthValue = data[3] + DycryptFifthValue;
        DycriptMergeArray.push(DycryptSixthValue);
        //-------------------------------------------------------
        DycriptMergeArray.push(data[4]);
        DycriptMergeArray.push(data[5]);
        //------------------------------------------------
        var DycryptSeventhValue = data[6] * configuredDividelength;
        //DycriptMergeArray.push(DycryptFifthValue);
        var DycryptEighthValue = data[7] + DycryptSeventhValue;
        DycriptMergeArray.push(DycryptEighthValue);
        DycriptMergeArray.push(data[8]);
        return DycriptMergeArray;
    } catch (error) {
        console.log("Error In ConvertInDecryptionData" + error);
        return null;
    }
}
//-------------------------------**********************--------------------------------------
//@@ Get Iot related Get, Post and Calculation method

function ConnectToGetIotModbus() {
    GateIoTclient.connectTCP(getIoTIpAddress, {
        port: getIoTportNumber
    })
        .then(function () {
            console.log("Gate IoT connected");
        }).catch(function (e) {
            if (e.errno) {
                if (networkErrors.includes(e.errno)) {
                    console.log(e.errno)
                }
            }
            console.log(e.message);
        });
}

//[333,18447,17735,22863,264,3090,4377,65000]
app.post('/api/WriteOnGateIoTCommand', (req, res) => {
   //console.log(req.body.data)
    if (req.body.data != null && req.body.data != undefined) {
        if (req.body.data.length == 5) {
            // console.log(conversionOfData(req.body.data))
            GateIoTclient.writeRegisters(1, conversionOfData(req.body.data)) //conversionOfData(req.body.data))
                .then(function (writeData) {
                    //console.log(writeData)
                    if (writeData != null && writeData != undefined) {
                        if (writeData.address == 1 && writeData.length == 8) {
                            res.status(200).send({
                                msg: 'Save Successfully',
                                code: 1
                            });
                        } else {
                            res.status(404).send('WriteOnGateIoTCommand Error when data write on divice');
                        }
                    } else {
                        res.status(404).send('WriteOnGateIoTCommand No responce');
                    }
                })
                .catch(function (e) {
                    ConnectToGetIotModbus();
                    res.status(404).send(e.message);
                })
        } else {
            res.status(404).send("WriteOnGateIoTCommand Data length error when encrypt data");
        }
    } else {
        res.status(404).send("WriteOnGateIoTCommand Please check all parametres");
    }
})


app.post('/api/UpdateStatusCommand', (req, res) => {
    if (req.body.data != null && req.body.data != undefined) {
        if (req.body.data.length == 2) {
            var encodeWriteValue = req.body.data[0] * configuredMergelength + req.body.data[1];
            // console.log(encodeWriteValue)
            GateIoTclient.writeRegisters(2, [encodeWriteValue, 0])
                .then(function (writeData) {
                   // console.log(writeData)
                    if (writeData != null && writeData != undefined) {
                        if (writeData.address == 2 && writeData.length == 2) {
                            res.status(200).send({
                                msg: 'Save Successfully',
                                code: 1
                            });
                        } else {
                            res.status(404).send(' UpdateStatusCommand Error when data write on divice');
                        }
                    }
                })
                .catch(function (e) {
                    ConnectToGetIotModbus();
                    res.status(404).send(e.message);
                })
        } else {
            res.status(404).send(" UpdateStatusCommand Data length error when encrypt data");
        }
    } else {
        res.status(404).send(" UpdateStatusCommand Please check all parametres");
    }
})

app.post('/api/WriteTimeStampCommand', (req, res) => {
    if (req.body.data != null && req.body.data != undefined) {
        if (req.body.data.length == 6) {
            var timeStamp = [];
            var TimeStampFirstWord = req.body.data[0] * configuredMergelength + req.body.data[1];
            timeStamp.push(TimeStampFirstWord);
            var TimeStampSecWord = req.body.data[2] * configuredMergelength + req.body.data[3];
            timeStamp.push(TimeStampSecWord);
            var TimeStampThirdWord = req.body.data[4] * configuredMergelength + req.body.data[5];
            timeStamp.push(TimeStampThirdWord);
            //console.log(timeStamp)
            GateIoTclient.writeRegisters(3, timeStamp) //conversionOfData(req.body.data))
                .then(function (writeData) {
                   // console.log(writeData)
                    if (writeData != null && writeData != undefined) {
                        if (writeData.address == 3 && writeData.length == 3) {
                            res.status(200).send({
                                msg: 'Save Successfully',
                                code: 1
                            });
                        } else {
                            res.status(404).send('WriteOnGateIoTCommand Error when data write on divice');
                        }
                    }
                })
                .catch(function (e) {
                    ConnectToGetIotModbus();
                    res.status(404).send(e.message);
                })
        } else {
            res.status(404).send("WriteOnGateIoTCommand Data length error when encrypt data");
        }
    } else {
        res.status(404).send("WriteOnGateIoTCommand Please check all parametres");
    }
})


app.get('/api/GetLoadingStatusHistoryData', (req, res) => {
    debugger
    if (req.param('loadingId')) {
        var EncryptFirstValue = parseInt(req.param('loadingId')) * configuredMergelength + 0;
        GateIoTclient.readHoldingRegisters(EncryptFirstValue, 1)
            .then(function (d) {
              
                if (d.data.length < 1) {
                    res.status(200).send({
                        msg: 'GetLoadingStatusHistoryData records not found',
                        code: 0
                    });
                } else {
                    var firstArrayToMerge = d.data.slice(0, 8);
                    if (firstArrayToMerge == null || firstArrayToMerge[1] == 0 || firstArrayToMerge[2] == 0) {
                        res.send({
                            msg: 'Record Not Found',
                            code: 0,
                            data: []
                        });
                        return;
                    }
                    var secArrayToMerge = d.data.slice(8, 120);
                    var finalArray = [];
                    var flag = 0;
                    var tempFlag = 0;
                    for (var i = 0; i < 112; i++) {
                        if (flag <= 3) {
                            finalArray.push(firstArrayToMerge[flag])
                            flag++;
                        } else if (flag == 7) {
                            finalArray.push(firstArrayToMerge[flag])
                            flag = 0;
                        } else {
                            finalArray.push(secArrayToMerge[tempFlag])
                            flag++;
                            tempFlag++;
                        }
                    }
                    var MergeDividedData = firstArrayToMerge.concat(finalArray)
                    var finalData = [];
                    startIndex = 0;
                    endIndex = 8;
                    for (let index = 0; index < MergeDividedData.length / 8; index++) {
                        if (index != 0) {
                            startIndex = endIndex;
                            endIndex = endIndex + 8;
                        }
                        var splitDataStatus = MergeDividedData.slice(startIndex, endIndex);
                       // console.log(splitDataStatus);
                        var hexConversion = [];
                        if (splitDataStatus.length == 8 && (splitDataStatus[4] != 0 && splitDataStatus[5] != 0)) {
                            for (let a = 0; a < splitDataStatus.length; a++) {
                                if (a == splitDataStatus.length - 1) {
                                    hexConversion.push(splitDataStatus[a]);
                                } else {
                                    hexConversion.push(toHexLarge(splitDataStatus[a]));
                                }
                            }
                            finalData[index] = FrameOfDecoding(hexConversion);
                        }
                    }
                    // console.log(finalData)
                    res.send({
                        msg: 'Record Fetch Successfully',
                        code: 1,
                        data: finalData
                    });
                }
            })
            .catch(function (e) {
                ConnectToGetIotModbus();
                res.status(404).send("connection Error Please try again");
            })
    } else {
        res.status(200).send({
            msg: 'Required two parameters',
            code: 0
        });
    }
})

app.get('/api/GetLoadingStatusData', (req, res) => {
    debugger
    if (req.param('loadingId') && req.param('statusId')) {
        var EncryptFirstValue = parseInt(req.param('loadingId') * configuredMergelength) + parseInt(req.param('statusId'));
      // console.log(EncryptFirstValue)
        GateIoTclient.readHoldingRegisters(EncryptFirstValue, 4)
            .then(function (d) {
               //console.log(d.data);
                if (d.data.length < 1) {
                    res.status(200).send({
                        msg: 'records not found',
                        code: 0
                    });
                } else {
                    var finalData = [];
                    startIndex = 0;
                    endIndex = 8;
                    for (let index = 0; index < d.data.length / 8; index++) {
                        if (index != 0) {
                            startIndex = endIndex;
                            endIndex = endIndex + 8;
                        }
                        var splitDataStatus = d.data.slice(startIndex, endIndex);
                        var hexConversion = [];
                        if (splitDataStatus.length == 8 && splitDataStatus[4] != 0 && splitDataStatus[5] != 0) {
                            for (let a = 0; a < splitDataStatus.length; a++) {
                                if (a == splitDataStatus.length - 1) {
                                    hexConversion.push(splitDataStatus[a]);
                                } else {
                                    hexConversion.push(toHexLarge(splitDataStatus[a]));
                                }
                            }
                            finalData[index] = FrameOfDecoding(hexConversion);
                        }
                    }
                    res.send({
                        msg: 'Record Fetch Successfully',
                        code: 1,
                        data: finalData
                    });
                }
            })
            .catch(function (e) {
                ConnectToGetIotModbus();
                res.status(404).send("Error " + e);
            })
    } else {
        res.status(200).send({
            msg: 'Required two parameters',
            code: 0
        });
    }
})


app.get('/api/DeleteLoadingStatus', (req, res) => {
    debugger
    if (req.param('loadingId')) {
        var EncryptFirstValue = (req.param('loadingId'));
        GateIoTclient.readHoldingRegisters(EncryptFirstValue, 2)
            .then(function (d) {
               // console.log(d)
                if (d.data.length == 1 && d.data[0] == '3142') {
                    res.send({
                        msg: 'Delete Complete Loading Info',
                        code: 1,
                        data: []
                    });
                } else {
                    res.send({
                        msg: 'somthing wends to wrong please try again',
                        code: 0,
                        data: []
                    });
                }
            })
            .catch(function (e) {
                ConnectToGetIotModbus();
                res.status(404).send("Error in read Holding Registers");
            })
    } else {
        res.send({
            msg: 'Required one parameters',
            code: 0,
            data: []
        });
       // res.status(404).send("Required two parameters");
    }
})

app.get('/api/CompleteStatusClear', (req, res) => {
    debugger
    GateIoTclient.readHoldingRegisters(0, 3)
        .then(function (d) {
            if (d.data.length == 1 && d.data[0] == '2413') {
                res.send({
                    msg: 'Truncate All Data',
                    code: 1,
                    data: []
                });
                //res.status(200).send("Truncate All Data");
            } else {
                res.send({
                    msg: 'somthing wents to wrong please try again',
                    code: 0,
                    data: []
                });
                //res.status(404).send("somthing wents to wrong please try again");
            }
        })
        .catch(function (e) {
            ConnectToGetIotModbus();
            res.status(404).send("connection Error Please try again");
        })
})
var hexArray = [];

function conversionOfData(frame) {
    hexArray = [];
    try {
        if (frame != null && frame.length == 5) {
            var loadingIdHex = toHex(frame[0]);
            hexArray.push(loadingIdHex);
            gethexArrayOfVehicalNo(frame[1]);
            var statusIdHex = toHex(frame[2]);
            hexArray.push(statusIdHex);
            var dayHex = toHex(frame[3].substring(0, 2));
            hexArray.push(dayHex);
            var monthHex = toHex(frame[3].substring(2, 4));
            hexArray.push(monthHex);
            var yearHex = toHex(frame[3].substring(4, 6));
            hexArray.push(yearHex);
            var HourHex = toHex(frame[3].substring(6, 8));
            hexArray.push(HourHex);
            var minHex = toHex(frame[3].substring(8, 10));
            hexArray.push(minHex);
            hexArray.push(frame[frame.length - 1]);
            return CreateFrameOfEncoding(hexArray);
            //console.log(hexArray);
        } else {
            return null;
        }
    } catch (error) {
        console.log("error in conversionOfData" + error);
        return null;
    }

}

function gethexArrayOfVehicalNo(vehicalno) {
    try {
        if (vehicalno != null && vehicalno != undefined) {
            vehicalno = validateVehicalNumber(vehicalno);
            if (vehicalno.length == 10) {
                var vehicalHexFirstChar = toHex(vehicalno.charAt(0).charCodeAt(0));
                hexArray.push(vehicalHexFirstChar);
                var vehicalHexSecChar = toHex(vehicalno.charAt(1).charCodeAt(0));
                hexArray.push(vehicalHexSecChar);
                var vehicalHexThirdChar = toHex((vehicalno.charAt(2) + "" + vehicalno.charAt(3)));
                hexArray.push(vehicalHexThirdChar);
                var vehicalHexFouthChar = toHex(vehicalno.charAt(4).charCodeAt(0));
                hexArray.push(vehicalHexFouthChar);
                var vehicalHexFifthChar = toHex(vehicalno.charAt(5).charCodeAt(0));
                hexArray.push(vehicalHexFifthChar);
                var vehicalSixthNumber = vehicalno.substring(6, 10);
                var EncryptFirstValue = toHex((Math.floor(vehicalSixthNumber / 100)));
                hexArray.push(EncryptFirstValue);
                var EncryptSecValue = toHex((vehicalSixthNumber % 100));
                hexArray.push(EncryptSecValue);
            } else {
                return null;
            }
        }
    } catch (error) {
        return null;
    }

}

function CreateFrameOfEncoding(hexArray) {
    try {
        if (hexArray != null && hexArray.length > 0) {
            var arrayOfEncodingFrame = [];
            arrayOfEncodingFrame.push(hexArray[0] + "" + hexArray[1]);
            arrayOfEncodingFrame.push(hexArray[2] + "" + hexArray[3]);
            arrayOfEncodingFrame.push(hexArray[4] + "" + hexArray[5]);
            arrayOfEncodingFrame.push(hexArray[6] + "" + hexArray[7]);
            arrayOfEncodingFrame.push(hexArray[8] + "" + hexArray[9]);
            arrayOfEncodingFrame.push(hexArray[10] + "" + hexArray[11]);
            arrayOfEncodingFrame.push(hexArray[12] + "" + hexArray[13]);
            arrayOfEncodingFrame.push(hexArray[hexArray.length - 1]);
            return ConvertHexToDecimal(arrayOfEncodingFrame);;
            //return FrameOfDecoding(arrayOfEncodingFrame);
        }
    } catch (error) {
        console.log("Error in CreateFrameOfEncoding" + error);
        return null;
    }
}

function ConvertHexToDecimal(arrayOfHex) {
    try {
        var decimalArray = [];
        for (let index = 0; index < arrayOfHex.length; index++) {
            if (index == arrayOfHex.length - 1) {
                decimalArray.push(arrayOfHex[index]);
            } else {
                decimalArray.push(parseInt(arrayOfHex[index], 16));
            }
        }
       // console.log(decimalArray);
        return decimalArray;
    } catch (error) {
        console.log("Error In ConvertHexToDecimal" + error)
    }
}

function validateVehicalNumber(vehicalno) {
    try {
        VhehicalNoSplit = vehicalno.split(' ')
        if (VhehicalNoSplit.length == 4) {
            var VhehicalNoSplitFirst = VhehicalNoSplit[0];
            var VhehicalNoSplitSec = VhehicalNoSplit[1];
            var VhehicalNoSplitThird = VhehicalNoSplit[2];
            var VhehicalNoSplitFourth = VhehicalNoSplit[3];

            if (VhehicalNoSplit[0].length < 2) {
                VhehicalNoSplitFirst = "-" + VhehicalNoSplit[0];
            }
            if (VhehicalNoSplit[1].length < 2) {
                VhehicalNoSplitSec = "0" + VhehicalNoSplit[1];
            }
            if (VhehicalNoSplit[2].length < 2) {
                VhehicalNoSplitThird = "-" + VhehicalNoSplit[2];
            }
            if (VhehicalNoSplit[3].length < 4) {
                tempString = '';
                for (let index = 0; index < VhehicalNoSplit[3].length; index++) {
                    tempString += "0";
                }
                VhehicalNoSplitFourth = tempString + VhehicalNoSplit[3];
            }
            return VhehicalNoSplitFirst + "" + VhehicalNoSplitSec + "" + VhehicalNoSplitThird + "" + VhehicalNoSplitFourth;
        } else {
            return null;
        }
    } catch (error) {
        console.log("Error In validateVehicalNumber" + error);
        return null;
    }
}

function FrameOfDecoding(frame) {
    debugger
    try {
        var decodeEncodeInHexArray = [];
        var decodeHexToDecimalArray = [];
        var stringArr = [1, 2, 4, 5];
        if (frame != null && frame.length == 8) {
            for (let j = 0; j < frame.length; j++) {
                if (j == frame.length - 1) {
                    decodeEncodeInHexArray.push(frame[j]);
                } else {
                    decodeEncodeInHexArray.push(frame[j].substring(0, 2));
                    decodeEncodeInHexArray.push(frame[j].substring(2, 4));
                }
            }
        } else {
            return null;
        }

        if (decodeEncodeInHexArray != null && decodeEncodeInHexArray.length == 15) {
            for (let k = 0; k < decodeEncodeInHexArray.length; k++) {
                if (k == decodeEncodeInHexArray.length - 1) {
                    decodeHexToDecimalArray.push(decodeEncodeInHexArray[k]);
                } else {
                    if (include(stringArr, k)) {
                        decodeHexToDecimalArray.push(String.fromCharCode(parseInt(decodeEncodeInHexArray[k], 16)))
                    } else {
                        decodeHexToDecimalArray.push(parseInt(decodeEncodeInHexArray[k], 16))
                    }
                }
            }
        } else {
            return null;
        }
        return mergeDecodedDataInRealFrame(decodeHexToDecimalArray);

    } catch (error) {
        console.log("Error In FrameOfDecoding" + error);
        return null;
    }

}
//LoadingId	VehicleNo	StatusId	Timestamp	Transporterid
function mergeDecodedDataInRealFrame(ObjData) {
    //console.log(ObjData)
    try {


        var correctFrame = [];
        var LoadingId = ObjData[0];
        var DycryptFirstValue = ObjData[6] * 100;
        var DycryptSecValue = ObjData[7] + DycryptFirstValue;
        var vehicalNumber = ObjData[1] + "" + ObjData[2] + " " + ObjData[3] + " " + ObjData[4] + "" + ObjData[5] + " " + DycryptSecValue
        var statusId = ObjData[8];
        var timeStamp = ObjData[9] + "," + ObjData[10] + "," + ObjData[11] + "," + ObjData[12] + "," + ObjData[13];
        correctFrame.push(LoadingId, vehicalNumber, statusId, timeStamp, ObjData[ObjData.length - 1]);
        return correctFrame;
    } catch (error) {
        console.log("Error in mergeDecodedDataInRealFrame" + error);
        return null;
    }
}

function include(arr, obj) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] == obj) return true;
    }
}

function toHex(d) {
    return ("0" + (Number(d).toString(16))).slice(-2).toUpperCase()
}

function toHexLarge(d) {
    return ("0" + (Number(d).toString(16))).slice(-4).toUpperCase()
}
//--Create Log File and store all log files
var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

app.listen(port, () => console.log('Server is running on port ' + port));