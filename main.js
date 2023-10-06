//import { BlaubergVentoResource, FunctionType, Parameter, DataEntry } from "blaugbergventojs";

("use strict");

/*
 * Created with @iobroker/create-adapter v2.5.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const blaubergVentoJS = require("blaubergventojs");

//const resource = new BlaubergVentoResource();

// Load your modules here, e.g.:
// const fs = require("fs");

async function asyncForEach(array, callback) {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array);
	}
}

class BlaubergVentilation extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "blauberg-ventilation",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		this.log.debug(`instance config: ${JSON.stringify(this.config)}`);

		if (typeof this.config.vents == "undefined" || !this.config.vents.length) {
			this.log.error("Please set at least one vent in the adapter configuration!");
			return;
		} else {
			try {
				const ventArray = this.config.vents;

				//Validate each Vent entry
				await asyncForEach(ventArray, async (vent) => {
					this.log.debug(
						"Vent Name: " + vent.name + "   Vent ID: " + vent.id + " Vent Password: " + vent.password,
					);

					if (!vent.name) {
						throw new Error("Invalid Vent configuration. Found Vent without name");
					}

					if (!vent.id) {
						throw new Error("Invalid Vent configuration. Found Vent without ID");
					} else if (vent.id.length != 16) {
						throw new Error("Invalid Vent configuration. Vent ID must be 16 Characters long");
					} // TODO: Check if ID is Hexadecimal -> Check with Regex???

					if (!vent.password) {
						throw new Error("Invalid Vent configuration. Found Vent without password");
					}

					const cleanVentName = this.cleanNamespace(vent.name);

					await this.setObjectNotExistsAsync("vents." + cleanVentName + ".name", {
						type: "state",
						common: {
							name: {
								en: "name",
								de: "Name",
							},
							type: "string",
							role: "value",
							//unit: "bla",
							read: true,
							write: false,
							def: "",
						},
						native: {},
					});

					await this.setStateChangedAsync("vents." + cleanVentName + ".name", vent.name), true;
				});
			} catch (err) {
				this.log.error(err);
				return;
			}
		}

		// Find all devices on the local network
		const resource = new blaubergVentoJS.BlaubergVentoResource();
		const client = new blaubergVentoJS.BlaubergVentoClient();
		const devices = await resource.findAll();

		let ventBuero = resource.findById("001F003442535303");
		(await ventBuero).speed = 3;
		console.log("IP: " + (await ventBuero).ipAddress);

		const packet = new blaubergVentoJS.Packet((await ventBuero).id, "1111", blaubergVentoJS.FunctionType.WRITE, [
			blaubergVentoJS.DataEntry.of(blaubergVentoJS.Parameter.SPEED, 1),
		]);

		// Send package and wait for response.
		const response = await client.send(packet, (await ventBuero).ipAddress);

		//(await ventBuero).speed = 3;
		//await resource.save(await ventBuero);

		//devices.content.forEach((vent) => console.log("blabla"));
		devices.content.forEach((vent) => console.log("IP: " + vent.ipAddress + " ID: " + vent.id));
		/*for (let i = 0; i < devices.size; i++) {
			console.log(devices.content[i].ipAddress);
			console.log(devices.content[i].id);
			console.log(devices.content[i].humidity);
		}*/

		//this.log.error("" + devices.size);
		//let device = devices[0];
		//this.log.error(device.ipAddress);

		// Reset the connection indicator during startup
		this.setState("info.connection", false, true);

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		await this.setObjectNotExistsAsync("testVariable", {
			type: "state",
			common: {
				name: "testVariable",
				type: "boolean",
				role: "indicator",
				read: true,
				write: true,
			},
			native: {},
		});

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates("testVariable");
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates("lights.*");
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates("*");

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		await this.setStateAsync("testVariable", true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		await this.setStateAsync("testVariable", { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync("admin", "iobroker");
		this.log.info("check user admin pw iobroker: " + result);

		result = await this.checkGroupAsync("admin", "admin");
		this.log.info("check group user admin group admin: " + result);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

	cleanNamespace(id) {
		return id
			.trim()
			.replace(/\s/g, "_") // Replace whitespaces with underscores
			.replace(/[^\p{Ll}\p{Lu}\p{Nd}]+/gu, "_") // Replace not allowed chars with underscore
			.replace(/[_]+$/g, "") // Remove underscores end
			.replace(/^[_]+/g, "") // Remove underscores beginning
			.replace(/_+/g, "_") // Replace multiple underscores with one
			.toLowerCase()
			.replace(/_([a-z])/g, (m, w) => {
				return w.toUpperCase();
			});
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new BlaubergVentilation(options);
} else {
	// otherwise start the instance directly
	new BlaubergVentilation();
}
