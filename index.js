const UsrcfgCgiService = require('procon-ip/lib/usrcfg-cgi.service').UsrcfgCgiService
const RelayDataInterpreter = require('procon-ip/lib/relay-data-interpreter').RelayDataInterpreter
const GetStateService = require('procon-ip/lib/get-state.service').GetStateService
const Logger = require('procon-ip/lib/logger').Logger
const logger = new Logger();
const config = require("./config/config.json");
const dataSource = new GetStateService(config["proconip"], logger)
const interpreter = new RelayDataInterpreter(logger)
const relaySwitcher = new UsrcfgCgiService(config['proconip'], logger, dataSource, interpreter)

var mqtt = require('mqtt')
var url = config['mqtt'].host
var options={
    clientId: config['mqtt'].topic,
    username: config['mqtt'].username,
    password: config['mqtt'].password,
    retain: config['mqtt'].retain,
    qos: config['mqtt'].qos,
    clean: config['mqtt'].clean,
    reconnectPeriod: config['mqtt'].reconnectPeriod 
};

var topic = config['mqtt'].topic.toString()

async function startup(){
    console.log('MQTT Connecting...')
    var client  = mqtt.connect(url, options)
    var bridgetopic = `${topic}/bridge/state`
    var payload = 'online';
    console.log(`Publish ${bridgetopic}, ${payload}`)
    client.publish(bridgetopic, payload, { retain: true, qos: 0 })
};

await startup( );

( async () => {
   
    for (entity in config['entities']) {
        if (config['entities'][entity]['subscribe'] == true) {
           await subscribe(config['entities'][entity], client, config)
        }
    }

})()

dataSource.start((data) => {    

    for (entity in config['entities']) {
        if (config['entities'][entity]['publish'] == true) {
            publish_state(data, config['entities'][entity], client, config)
        }
      }
})

client.on('message', function (topic, message) {
    ( async () => {
    var settopic = topic.toString().split('/')
    if (settopic[2] == 'set'){
        var data = await updateData(dataSource)

        var id = config['entities'][settopic[1]].id
        var relay = data.getDataObject(id)
        console.log(message.toString())
        switch (message.toString()) {
            case 'auto':
                relaySwitcher.setAuto(relay).then(r => {
                    logger.info(`${relay.label} has been turned auto (response code: ${r})`)
                })
                break            
            case 'on':
                relaySwitcher.setOn(relay).then(r => {
                    logger.info(`${relay.label} has been turned on (response code: ${r})`)
                })
                break            
            case 'off':
                relaySwitcher.setOff(relay).then(r => {
                    logger.info(`${relay.label} has been turned off (response code: ${r})`)
                })
                break     
        } 
}
})()
})

client.on('close', function (topic) {
    console.log('MQTT Connection closed')
})

process.on('SIGINT',  shutdown);

async function updateData(dsource){
    let v
    try {
      data = await dsource.update()
    } catch(e) {
      //v = await downloadFallbackData(url)
    }
    return data
}


async function subscribe(entity, client, config) {
    var label = entity.name    
    var topic = `${config['mqtt'].topic.toString()}/${label}/set`
    client.subscribe(topic)
    console.log(`Subscribe to ${topic}`)
}

async function publish_state(data, entity, client, config) {
    var dataObject = data.getDataObject(entity.id)
    var label = entity.name
    var topic = `${config['mqtt'].topic.toString()}/${label}`
    var value = dataObject.value
    var category = dataObject.category
    var unit = dataObject.unit
    var date = new Date()
    var timestamp = date.toISOString()
    var payload_data = { "last_update": timestamp , "label": dataObject.label, "category": dataObject.category, "type": entity.type, "value": value, "unit": unit }
          
    if (category == 'relays') {
        switch (value) {
            case 0:
                var state = 'off'
                var auto = 'on'
                break            
            case 1:
                var state = 'on'
                var auto = 'on'
                break
            case 2:
                var state = 'off'                
                var auto = 'off'
                break
            case 3:
                var state = 'on'
                var auto = 'off'
                break
            default:
                var state = 'unknown'
                var auto = 'unknown'                     
          }
          payload_data['state'] = state
          payload_data['auto'] = auto
      } 

    var payload = JSON.stringify(payload_data)
    console.log(`Publish ${topic}, ${payload}`)
    client.publish(topic, payload)
}

// Do graceful shutdown
async function shutdown() {
    console.log('SIGINT sent')
    var payload = 'offline';
    console.log(`Publish ${bridgetopic}, ${payload}`)
    client.publish(bridgetopic, payload, { retain: true, qos: 0 })
    client.end(exit)
  };

async function exit(){
    console.log('Shutting down')
    process.exit()        
};