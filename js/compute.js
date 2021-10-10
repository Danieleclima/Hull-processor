const { values } = require("lodash");
const _ = require("lodash");
const urijs = require("urijs");

const account = require("../sample_account.json");

/**
 *
 * TODO:
 *
 * 1. Fix strategy for name
 * 2. Finish extracting the domain from website values
 *
 * Add new strategies to array:
 *
 * 3. Compute unified value for number of employees
 * 4. Compute unified value for name of country
 * 5. Compute unified value for ISO-2 country code.
 *
 * Use all available data in sample_account.json *
 *
 * Bonus: Add new features to Compute if something becomes repetetive.
 *
 * During the interview, please be prepared to show and run the program.
 *
 */

// change to true/false if you want to see the entire Compute instance logged.
const CONSOLE_LOG_COMPUTE_DATA = true;

const STRATEGIES = [
  // Something is wrong with this strategy, can't figure out why it doesn't work.
  {
    output_property: "account/name",
    input_properties: ["clearbit.name", "hubspot.name", "goodfit.name"],
  },
  // Need to finish this using urijs
  {
    output_property: "domain",
    input_properties: [
      "hubspot.website",
      "system.first_known_website",
      "clearbit.domain",
    ],
    compute_template: "custom",
    custom_method: (values) => {
      // How to get the right value here?
      const website = _.head(values);
      const uri = urijs(website);
      const domain = uri.domain();
      console.log("Domain log:", domain);
      return domain;
    },
  },
  {
    output_property: "icp_properties/estimated_revenue",
    input_properties: [
      "clearbit.metrics_annual_revenue",
      "hubspot.annual_revenue",
    ],
    compute_template: "max",
  },
  {
    output_property: "account/number_of_employees",
    input_properties: [
      "icp_properties.employee_count_number",
      "clearbit.metrics_employees",
    ],
    compute_template: "most_frequent",
  },
  {
    output_property: "account/name_of_country",
    input_properties: [
      "icp_properties.country_name_headquarters",
      "clearbit.geo_country",
      "goodfit.country_code",
      "aggregations.country_name_headquarters",
      ['user_submitted', 'country_name', 'r.makara@paddle.com'],
    ],
    compute_template: "custom",
    custom_method: mostCommonValue,
  },
  {
    output_property: "account/ISO_country_code",
    input_properties: [
      "icp_properties.country_iso_headquarters",
      "clearbit.geo_country_code",
      "hubspot.country",
      "goodfit.country_code",
    ],
    compute_template: "custom",
    custom_method: mostCommonValue,
  },
];

function mostCommonValue(values) {
  const list = _.compact(
    _.map(values, (value) => {
      return value;
    })
  );
  return _.head(_(list).countBy().entries().maxBy(_.last));
}

class Compute {
  constructor(strategy) {
    this.output_property = strategy.output_property;
    this.input_properties = strategy.input_properties;
    this.compute_template = strategy.compute_template;
    this.custom_method = strategy.custom_method || this._computeCustomMethod;
    this.update_needed = false;
    this.attribute_data = [];
    this.attribute = {};
  }

  run() {
    this._composeAttributeData();
    this._computeMethod(this.attribute_data);
    this._checkExitConditions();
    if (CONSOLE_LOG_COMPUTE_DATA) {
      console.log(this, "\n");
    }
  }

  _computeMethod(values) {
    if (_.isEmpty(values)) {
      return;
    } else if (this.compute_template === "most_frequent") {
      this.attribute[this.output_property] = _.head(
        _(values).countBy().entries().maxBy(_.last)
      );
    } else if (this.compute_template === "max") {
      this.attribute[this.output_property] = _.max(values);
    } else if (this.compute_template === "custom") {
      const attribute = this.custom_method(values);
      this.attribute[this.output_property] = attribute;
    } else {
      const attribute = _.head(values);
      this.attribute[this.output_property] = attribute;
    }
  }

  // mapping paths to their current values and adding all those values to the this.attribute_data property
  _composeAttributeData() {
    const values = _.map(this.input_properties, (property) => {
      const value = _.get(account, property, undefined);
      console.log("ComposeAttribute Method result:", property, value);
      return value;
    });
    console.log("Values array", values);
    this.attribute_data = _.compact(values);
  }

  _checkExitConditions() {
    // checking if the this.attribute keys are empty.
    const isEmpty = (target) => {
      const keys = Object.keys(target);
      return keys.length === 0;
    };

    if (this.output_property === undefined) return;
    if (isEmpty(this.attribute) === true) return;

    // checking if there's already an existing value for the attribute in question.
    const path = _.replace(this.output_property, "/", ".");
    const currentAttributeValue = _.get(account, path, undefined);
    console.log("Current Attribute Value:", currentAttributeValue);

    if (currentAttributeValue === undefined) {
      this.update_needed = true;
      return;
    }

    console.log("Is new value logic:", {
      [this.output_property]: currentAttributeValue,
    });
    const isNewValue = !_.isEqual(this.attribute, {
      [this.output_property]: currentAttributeValue,
    });

    if (isNewValue === true) {
      this.update_needed = true;
      return;
    }
    return false;
  }
}

const attributes = {};

_.forEach(STRATEGIES, (strategy) => {
  const compute = new Compute(strategy);
  compute.run();

  const hasValue = compute.attribute[compute.output_property];

  if (compute.update_needed === true && hasValue) {
    _.assign(attributes, compute.attribute);
  }
});

console.log("UPDATED ATTRIBUTES:", attributes);
