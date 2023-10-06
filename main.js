//import { BlaubergVentoResource, FunctionType, Parameter, DataEntry } from "blaugbergventojs";

("use strict");

const BlaubergVentoClient = require("blaubergventojs").BlaubergVentoClient;
const BlaubergVentoResource = require("blaubergventojs").BlaubergVentoResource;

// core ioBroker functions
const utils = require("@iobroker/adapter-core");
// functions to read and write vents
const blaubergVentoJS = require("blaubergventojs");

async function asyncForEach(array, callback) {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array);
	}
}

const ID = "ID";
const ON_OFF = "On_Off";
const SPEED = "Speed";
//const BOOST_MODE = "Boost_Mode";
//const TIMER_MODE = "Timer_Mode";
//const TIMER_COUNT_DOWN = "TIMER_COUNT_DOWN";
/*HUMIDITY_SENSOR_ACTIVATION,
    RELAY_SENSOR_ACTIVIATION,
    VOLTAGE_SENSOR_ACTIVATION,
    HUMIDITY_THRESHOLD,
    CURRENT_RTC_BATTERY_VOLTAGE,
    CURRENT_HUMIDITY,
    CURRENT_VOLTAGE_SENSOR_STATE,
    CURRENT_RELAY_SENSOR_STATE,
    MANUAL_SPEED,
    FAN1RPM,
    FAN2RPM,
    FILTER_TIMER,
    RESET_FILTER_TIMER,
    BOOST_MODE_DEACTIVATION_DELAY,
    RTC_TIME,
    RTC_CALENDAR,
    WEEKLY_SCHEDULE,
    SCHEDULE_SETUP,
    SEARCH,
    PASSWORD,
    MACHINE_HOURS,
    RESET_ALARMS,
    READ_ALARM,
    CLOUD_SERVER_OPERATION_PERMISSION,
    READ_FIRMWARE_VERSION,
    RESTORE_FACTORY_SETTINGS,
    FILTER_ALARM,
    WIFI_MODE,
    WIFI_NAME,
    WIFI_PASSWORD,
    WIFI_ENCRYPTION,
    WIFI_CHANNEL,
    WIFI_DHCP,*/
//const IP_ADDRESS = "IP_Address";
//const SUBNET_MASK = "Subnet_Mask";
//const GATEWAY = "Gateway";
const CURRENT_IP_ADDRESS = "Current_IP_Address";
const VENTILATION_MODE = "Ventilation_Mode";
//const UNIT_TYPE = "Unit_Type";

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

		// Key in this Map ist the id for each state, Value is the configuration for the corresponding vent
		this.configMap = new Map();
		// Key in this Map ist the id for each state, Value is the Parameter (number) to be send by API
		this.parameterMap = new Map();

		this.client = new BlaubergVentoClient();
		this.resource = new BlaubergVentoResource();

		this.updateInterval = null;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Alle eigenen States abonnieren
		await this.subscribeStatesAsync("vents.*");

		this.log.debug(`instance config: ${JSON.stringify(this.config)}`);

		if (typeof this.config.vents == "undefined" || !this.config.vents.length) {
			this.log.error("Please set at least one vent in the adapter configuration!");
			return;
		} else {
			try {
				//Validate each Vent entry
				await asyncForEach(this.config.vents, async (ventConfigEntry) => {
					this.validateVentConfig(ventConfigEntry);

					this.createDeviceAndStringState(ventConfigEntry, 0, "info", ID, "", false);
					this.createDeviceAndStringState(ventConfigEntry, 0, "info", CURRENT_IP_ADDRESS, "", false);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.VENTILATION_MODE, "control", VENTILATION_MODE, "", true, 0, 2);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.SPEED, "control", SPEED, "", true, 1, 3);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.ON_OFF, "control", ON_OFF, "", true, 0, 1);
				});
			} catch (err) {
				this.log.error(err);
				return;
			}
		}

		this.updateintervall = setInterval(async () => {
			this.updateVentdataPeriodically();
		}, parseInt("10000"));

		// Reset the connection indicator during startup
		this.setState("info.connection", false, true);
	}

	validateVentConfig(vent) {
		this.log.debug("Vent Name: " + vent.name + "   Vent ID: " + vent.id + " Vent Password: " + vent.password);

		if (!vent.name) {
			throw new Error("Invalid Vent configuration. Found Vent without name");
		}

		const hexRegexp = /^[0-9A-F]+$/;
		if (!vent.id) {
			throw new Error("Invalid Vent configuration. Found Vent without ID");
		} else if (vent.id.length != 16) {
			throw new Error("Invalid Vent configuration. Vent ID must be 16 Characters long: " + vent.id);
		} else if (!hexRegexp.test(vent.id)) {
			throw new Error("Invalid Vent configuration. Vent ID must be hexadecimal. Only decimals 0-9 and uppercase letters A-F are allowed: " + vent.id);
		}

		if (!vent.password) {
			throw new Error("Invalid Vent configuration. Found Vent without password");
		}
	}

	/**
	 * @param {any} ventConfigEntry
	 * @param {number} parameter
	 * @param {string} channelName
	 * @param {string} objectName
	 * @param {string} unit
	 * @param {boolean} writeAllowed
	 */
	createDeviceAndStringState(ventConfigEntry, parameter, channelName, objectName, unit, writeAllowed) {
		const cleanVentName = this.cleanNamespace(ventConfigEntry.name);

		this.createDeviceObject(cleanVentName);
		this.createChannelObject(cleanVentName, channelName);

		const path = this.createPath(cleanVentName, channelName, objectName);

		this.setObjectNotExistsAsync(path, {
			type: "state",
			common: {
				name: objectName,
				type: "string",
				role: "value",
				unit: unit,
				read: true,
				write: writeAllowed,
			},
			native: {},
		});

		this.configMap.set(path, ventConfigEntry);
		this.parameterMap.set(path, parameter);
	}

	/**
	 * @param {any} ventConfigEntry
	 * @param {number} parameter
	 * @param {string} channelName
	 * @param {string} objectName
	 * @param {string} unit
	 * @param {boolean} writeAllowed
	 * @param {number} min
	 * @param {number} max
	 */
	createDeviceAndNumberState(ventConfigEntry, parameter, channelName, objectName, unit, writeAllowed, min, max) {
		const cleanVentName = this.cleanNamespace(ventConfigEntry.name);

		this.createDeviceObject(cleanVentName);
		this.createChannelObject(cleanVentName, channelName);

		const path = this.createPath(cleanVentName, channelName, objectName);

		this.setObjectNotExistsAsync(path, {
			type: "state",
			common: {
				name: objectName,
				type: "number",
				role: "value",
				unit: unit,
				min: min,
				max: max,
				read: true,
				write: writeAllowed,
			},
			native: {},
		});

		this.configMap.set(path, ventConfigEntry);
		this.parameterMap.set(path, parameter);
	}

	createPath(cleanVentName, channelName, objectName) {
		return "vents."
			.concat(cleanVentName)
			.concat(channelName.length > 0 ? "." + channelName : "")
			.concat("." + objectName);
	}

	/**
	 * @param {string} cleanVentName
	 */
	createDeviceObject(cleanVentName) {
		this.setObjectNotExistsAsync("vents." + cleanVentName, {
			type: "device",
			common: {
				name: "",
			},
			native: {},
		});
	}

	/**
	 * @param {string} cleanVentName
	 */
	createChannelObject(cleanVentName, channelName) {
		this.setObjectNotExistsAsync("vents." + cleanVentName + "." + channelName, {
			type: "channel",
			common: {
				name: "",
			},
			native: {},
		});
	}

	updateVentdataPeriodically() {
		this.log.debug("called updateVentdataPeriodically");

		asyncForEach(this.config.vents, async (ventConfigEntry) => {
			const cleanVentName = this.cleanNamespace(ventConfigEntry.name);
			const vent = this.resource.findById(ventConfigEntry.id);

			if (vent) {
				const ipAddress = (await vent).ipAddress;
				const id = (await vent).id;
				const mode = (await vent).mode;
				const speed = (await vent).speed;
				const power = (await vent).on;

				// First part of the path (informational states) e.g. "vents.livingroom.info."
				const pathPrefixInfo = "vents.".concat(cleanVentName).concat(".info.");
				const pathPrefixControl = "vents.".concat(cleanVentName).concat(".control.");

				this.setStateChanged(pathPrefixInfo.concat(ID), id, true);
				this.setStateChanged(pathPrefixInfo.concat(CURRENT_IP_ADDRESS), ipAddress, true);

				this.setStateChanged(pathPrefixControl.concat(ON_OFF), power, true);
				this.setStateChanged(pathPrefixControl.concat(SPEED), speed ? speed : "", true);
				this.setStateChanged(pathPrefixControl.concat(VENTILATION_MODE), mode ? mode : "", true);

				this.log.debug(ipAddress);
			}
		});
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.updateInterval) {
				clearInterval(this.updateInterval);
			}

			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		if (state && state.ack == false) {
			/*
				The ID comes with the complete namespace, including the adaptername and instance number
				e.g. "blauberg-ventilation.0.vents.buero.control.speed". We need the id without this namespace,
				so only "vents.buero.control.speed" in this example
			*/
			id = id.substring(this.namespace.length + 1);

			// Check if we have a vent config in the map for this state id and get it
			if (this.configMap.has(id) && this.parameterMap.has(id)) {
				const configEntry = this.configMap.get(id);
				const parameter = this.parameterMap.get(id);

				this.log.error("Parameter: " + parameter);

				const ventID = configEntry.id;
				const password = configEntry.password;

				this.log.error(ventID);
				this.log.error(configEntry.name);
				this.log.error(password);

				const vent = this.resource.findById(ventID);

				const value = Number(state.val);
				this.log.error("State: " + state.val);
				this.log.error("Number: " + value);

				const packet = new blaubergVentoJS.Packet(ventID, password, blaubergVentoJS.FunctionType.WRITE, [blaubergVentoJS.DataEntry.of(parameter, value)]);
				// Send package and wait for response.
				try {
					this.client.send(packet, (await vent).ipAddress);
				} catch (err) {
					this.log.error(err);
					return;
				}
			}
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	/**
	 * @param {string} id
	 */
	cleanNamespace(id) {
		return id
			.trim()
			.toLowerCase()
			.replace(/ä/g, "ae")
			.replace(/ö/g, "oe")
			.replace(/ü/g, "ue")
			.replace(/\s/g, "_") // Replace whitespaces with underscores
			.replace(/[^\p{Ll}\p{Lu}\p{Nd}]+/gu, "_") // Replace not allowed chars with underscore
			.replace(/[_]+$/g, "") // Remove underscores end
			.replace(/^[_]+/g, "") // Remove underscores beginning
			.replace(/_+/g, "_") // Replace multiple underscores with one
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
