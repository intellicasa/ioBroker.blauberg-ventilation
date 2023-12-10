//import { BlaubergVentoResource, FunctionType, Parameter, DataEntry } from "blaugbergventojs";

("use strict");

const BlaubergVentoClient = require("blaubergventojs").BlaubergVentoClient;
const BlaubergVentoResource = require("blaubergventojs").BlaubergVentoResource;
//const Packet = require("blaubergventojs").Packet;
//const FunctionType = require("blaubergventojs").FunctionType;
//const DataEntry = require("blaubergventojs").DataEntry;
//const Parameter = require("blaubergventojs").Parameter;

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
const ON_OFF = "On/Off";
const SPEED = "Speed";
//const BOOST_MODE = "Boost_Mode";
//const TIMER_MODE = "Timer_Mode";
//const TIMER_COUNT_DOWN = "TIMER_COUNT_DOWN";
//const HUMIDITY_SENSOR_ACTIVATION = "HUMIDITY_SENSOR_ACTIVATION";
//const RELAY_SENSOR_ACTIVIATION = "RELAY_SENSOR_ACTIVIATION";
//const VOLTAGE_SENSOR_ACTIVATION = "VOLTAGE_SENSOR_ACTIVATION";
//const HUMIDITY_THRESHOLD = "HUMIDITY_THRESHOLD";
//const CURRENT_RTC_BATTERY_VOLTAGE = "CURRENT_RTC_BATTERY_VOLTAGE";
const CURRENT_HUMIDITY = "Humidity";
//const CURRENT_VOLTAGE_SENSOR_STATE = "CURRENT_VOLTAGE_SENSOR_STATE";
//const CURRENT_RELAY_SENSOR_STATE = "CURRENT_RELAY_SENSOR_STATE";
const MANUAL_SPEED = "Manual Speed";
const FAN1RPM = "Fan1 Rpm";
//const FAN2RPM = "Fan2 Rpm";
const FILTER_TIMER_MINUTES = "Filtertimer Countdown (Minutes)";
const FILTER_TIMER_STRING = "Filtertimer Countdown";
//const RESET_FILTER_TIMER = "RESET_FILTER_TIMER";
//const BOOST_MODE_DEACTIVATION_DELAY = "BOOST_MODE_DEACTIVATION_DELAY";
//const RTC_TIME = "RTC_TIME";
//const RTC_CALENDAR = "RTC_CALENDAR";
//const WEEKLY_SCHEDULE = "WEEKLY_SCHEDULE";
//const SCHEDULE_SETUP = "SCHEDULE_SETUP"
//const SEARCH = "SEARCH";
//const PASSWORD = "PASSWORD";
//const MACHINE_HOURS = "MACHINE_HOURS";
//const RESET_ALARMS = "RESET_ALARMS";
//const READ_ALARM = "READ_ALARM";
//const CLOUD_SERVER_OPERATION_PERMISSION = "CLOUD_SERVER_OPERATION_PERMISSION";
const READ_FIRMWARE_VERSION = "Firmware Version";
const FIRMWARE_DATE = "Firmware Date";
//const RESTORE_FACTORY_SETTINGS = "RESTORE_FACTORY_SETTINGS";
const FILTER_ALARM = "Filter Alarm";
//const WIFI_MODE = "WIFI_MODE";
//const WIFI_NAME = "WIFI_NAME";
//const WIFI_PASSWORD = "WIFI_PASSWORD";
//const WIFI_ENCRYPTION = "WIFI_ENCRYPTION";
//const WIFI_CHANNEL = "WIFI_CHANNEL";
//const WIFI_DHCP = "WIFI_CHANNEL";
//const IP_ADDRESS = "IP_Address";
//const SUBNET_MASK = "Subnet_Mask";
//const GATEWAY = "Gateway";
const CURRENT_IP_ADDRESS = "Current IP Address";
const VENTILATION_MODE = "Ventilation Mode";
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

		/**
		 * @type {string | number | NodeJS.Timeout | null | undefined}
		 */
		this.updateInterval = null;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Alle eigenen States abonnieren
		await this.subscribeStatesAsync("vents.*");

		//this.log.debug(`instance config: ${JSON.stringify(this.config)}`);

		if (typeof this.config.vents == "undefined" || !this.config.vents.length) {
			this.log.error("Please set at least one vent in the adapter configuration!");
			return;
		} else {
			try {
				//Validate each Vent entry
				await asyncForEach(this.config.vents, async (ventConfigEntry) => {
					this.validateVentConfig(ventConfigEntry);

					this.createDeviceAndStringState(ventConfigEntry, 0, "info", ID, "", false);
					this.createDeviceAndStringState(ventConfigEntry, blaubergVentoJS.Parameter.CURRENT_IP_ADDRESS, "info", CURRENT_IP_ADDRESS, "", false);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.FAN1RPM, "info", FAN1RPM, "", false, 0, 10000);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.FILTER_ALARM, "info", FILTER_ALARM, "", false, 0, 1);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.FILTER_TIMER, "info", FILTER_TIMER_MINUTES, "Minutes", false, 0, 129600);
					this.createDeviceAndStringState(ventConfigEntry, 0, "info", FILTER_TIMER_STRING, "", false);
					this.createDeviceAndStringState(ventConfigEntry, 0, "info", FIRMWARE_DATE, "", false);
					this.createDeviceAndStringState(ventConfigEntry, blaubergVentoJS.Parameter.READ_FIRMWARE_VERSION, "info", READ_FIRMWARE_VERSION, "", false);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.CURRENT_HUMIDITY, "info", CURRENT_HUMIDITY, "%", false, 0, 100);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.MANUAL_SPEED, "control", MANUAL_SPEED, "%", true, 0, 100);
					//this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.BOOT_MODE, "info", BOOST_MODE, "", false, 0, 1);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.VENTILATION_MODE, "control", VENTILATION_MODE, "", true, 0, 2);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.SPEED, "control", SPEED, "", true, 1, 255);
					this.createDeviceAndNumberState(ventConfigEntry, blaubergVentoJS.Parameter.ON_OFF, "control", ON_OFF, "", true, 0, 1);
				});
			} catch (err) {
				this.log.error(err);
				return;
			}
		}

		const updateIntervalTime = this.config.pollInterval * 1000;

		this.updateintervall = setInterval(async () => {
			this.updateVentdataPeriodically();
		}, updateIntervalTime);

		// Reset the connection indicator during startup
		this.setState("info.connection", true, true);
	}

	validateVentConfig(vent) {
		if (!vent.name) {
			throw new Error("Invalid Vent configuration. Found Vent without name");
		}

		const hexRegexp = /^[0-9A-F]+$/;
		if (!vent.id) {
			throw new Error("Invalid Vent configuration. Found Vent without ID");
		} else if (vent.id.length != 16) {
			throw new Error(
				"Invalid Vent configuration. Vent ID must be 16 Characters long: " + vent.id,
			);
		} else if (!hexRegexp.test(vent.id)) {
			throw new Error(
				"Invalid Vent configuration. Vent ID must be hexadecimal. Only decimals 0-9 and uppercase letters A-F are allowed: " +
				vent.id,
			);
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
	createDeviceAndStringState(
		ventConfigEntry,
		parameter,
		channelName,
		objectName,
		unit,
		writeAllowed,
	) {
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
	createDeviceAndNumberState(
		ventConfigEntry,
		parameter,
		channelName,
		objectName,
		unit,
		writeAllowed,
		min,
		max,
	) {
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
		asyncForEach(this.config.vents, async (ventConfigEntry) => {
			const cleanVentName = this.cleanNamespace(ventConfigEntry.name);
			try {
				const response = this.resource.findById(ventConfigEntry.id);

				/*const packet = new Packet(ventConfigEntry.id, ventConfigEntry.password, FunctionType.READ, [
				DataEntry.of(Parameter.ON_OFF),
				DataEntry.of(Parameter.SP50*2,5098EED),
				DataEntry.of(Parameter.BOOT_MODE),
				DataEntry.of(Parameter.TIMER_MODE),
				DataEntry.of(Parameter.TIMER_COUNT_DOWN),
				DataEntry.of(Parameter.HUMIDITY_SENSOR_ACTIVATION),
				DataEntry.of(Parameter.RELAY_SENSOR_ACTIVIATION),
				DataEntry.of(Parameter.VOLTAGE_SENSOR_ACTIVATION),
				DataEntry.of(Parameter.HUMIDITY_THRESHOLD),
				DataEntry.of(Parameter.CURRENT_RTC_BATTERY_VOLTAGE),
				DataEntry.of(Parameter.CURRENT_HUMIDITY),
				DataEntry.of(Parameter.CURRENT_VOLTAGE_SENSOR_STATE),
				DataEntry.of(Parameter.CURRENT_RELAY_SENSOR_STATE),
				DataEntry.of(Parameter.MANUAL_SPEED),
				DataEntry.of(Parameter.FAN1RPM),
				DataEntry.of(Parameter.FAN2RPM),
				DataEntry.of(Parameter.FILTER_TIMER),
				DataEntry.of(Parameter.BOOST_MODE_DEACTIVATION_DELAY),
				DataEntry.of(Parameter.RTC_TIME),
				DataEntry.of(Parameter.RTC_CALENDAR),
				DataEntry.of(Parameter.WEEKLY_SCHEDULE),
				DataEntry.of(Parameter.SCHEDULE_SETUP),
				DataEntry.of(Parameter.SEARCH),
				DataEntry.of(Parameter.PASSWORD),
				DataEntry.of(Parameter.MACHINE_HOURS),
				DataEntry.of(Parameter.READ_ALARM),
				DataEntry.of(Parameter.CLOUD_SERVER_OPERATION_PERMISSION),
				DataEntry.of(Parameter.READ_FIRMWARE_VERSION),
				DataEntry.of(Parameter.FILTER_ALARM),
				DataEntry.of(Parameter.WIFI_MODE),
				DataEntry.of(Parameter.WIFI_NAME),
				DataEntry.of(Parameter.WIFI_PASSWORD),
				DataEntry.of(Parameter.WIFI_ENCRYPTION),
				DataEntry.of(Parameter.WIFI_CHANNEL),
				DataEntry.of(Parameter.WIFI_DHCP),
				DataEntry.of(Parameter.IP_ADDRESS),
				DataEntry.of(Parameter.SUBNET_MASK),
				DataEntry.of(Parameter.GATEWAY),
				DataEntry.of(Parameter.CURRENT_IP_ADDRESS),
				DataEntry.of(Parameter.VENTILATION_MODE),
				DataEntry.of(Parameter.UNIT_TYPE),
			]);*/

				const vent = await response.catch(() => { return null; });

				if (vent) {
					const ipAddress = vent.ipAddress;
					//this.response = this.client.send(packet, ipAddress);

					const id = vent.id;
					//const isOn = this.response.packet.dataEntries[0].value;
					const mode = vent.mode;
					const speed = vent.speed;
					const power = vent.on;
					const fan1Rpm = vent.fan1Rpm;
					const filterAlarm = vent.filterAlarm;
					const filterTime = vent.filterTime;

					const days = Math.floor(filterTime / 1440);
					const daysRest = filterTime % (60 * 24);
					const hours = Math.floor(daysRest / 60);
					const minutes = daysRest % 60;
					const daysString = days > 0 ? days + " Tage " : "";
					const hoursString = hours > 0 ? hours + " Stunden " : "";
					const minutesString = minutes + " Minuten";
					const filterTimeString = daysString.concat(hoursString).concat(minutesString);

					const firmwareDate = vent.firmwareDate.toLocaleDateString();
					const firmwareVersion = vent.firmwareVersion;
					const humidity = vent.humidity;
					/* 	Parameter 68 = Manual Speed and is defined as 0..255
					We want to set it as 0..100% so we need to make a conversion from percdntage to byte */
					const manualSpeed = Math.round((vent).manualSpeed / 2.56);

					// First part of the path (informational states) e.g. "vents.livingroom.info."
					const pathPrefixInfo = "vents.".concat(cleanVentName).concat(".info.");
					const pathPrefixControl = "vents.".concat(cleanVentName).concat(".control.");

					this.setStateChanged(pathPrefixInfo.concat(ID), id, true);
					this.setStateChanged(pathPrefixInfo.concat(CURRENT_IP_ADDRESS), ipAddress, true);

					this.setStateChanged(pathPrefixControl.concat(ON_OFF), power, true);
					//this.setStateChanged(pathPrefixControl.concat(BOOST_MODE), power, true);
					this.setStateChanged(pathPrefixControl.concat(SPEED), speed ? speed : "", true);
					this.setStateChanged(pathPrefixInfo.concat(FAN1RPM), fan1Rpm ? fan1Rpm : "", true);
					this.setStateChanged(pathPrefixInfo.concat(FILTER_ALARM), filterAlarm, true);
					this.setStateChanged(pathPrefixInfo.concat(FILTER_TIMER_MINUTES), filterTime, true);
					this.setStateChanged(pathPrefixInfo.concat(FILTER_TIMER_STRING), filterTimeString, true);
					this.setStateChanged(pathPrefixInfo.concat(FIRMWARE_DATE), firmwareDate, true);
					this.setStateChanged(pathPrefixInfo.concat(READ_FIRMWARE_VERSION), firmwareVersion, true);
					this.setStateChanged(pathPrefixInfo.concat(CURRENT_HUMIDITY), humidity, true);
					this.setStateChanged(pathPrefixControl.concat(MANUAL_SPEED), manualSpeed, true);
					this.setStateChanged(pathPrefixControl.concat(VENTILATION_MODE), mode ? mode : 0, true);
				}
			} catch (err) {
				this.log.error(err);
				return;
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

			this.log.debug(`ID: ${id}`);

			// Check if we have a vent config in the map for this state id and get it
			if (this.configMap.has(id) && this.parameterMap.has(id)) {
				const configEntry = this.configMap.get(id);
				const parameter = this.parameterMap.get(id);

				this.log.error("Parameter: " + parameter);

				const ventID = configEntry.id;
				const password = configEntry.password;

				const vent = this.resource.findById(ventID);

				let value = Number(state.val);

				/* 	Parameter 68 = Manual Speed and is defined as 0..255
					We want to set it as 0..100% so we need to make a conversion from percentage to byte */
				if (parameter === 68) {
					value = Math.round(value * 2.56);
				}

				const packet = new blaubergVentoJS.Packet(
					ventID,
					password,
					blaubergVentoJS.FunctionType.WRITE,
					[blaubergVentoJS.DataEntry.of(parameter, value)],
				);
				// Send package and wait for response.
				try {
					this.client.send(packet, (await vent).ipAddress);
				} catch (err) {
					this.log.error(err);
					return;
				}
			}
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
