external js: 'a => Js_json.t = "%identity";

/* Command */

module Command = {

  exception Missing(string);

  type cqesCommand('data) = {
    key:  string,
    data: 'data
  };

  let toJs = (key, order, data) => {
    "key":       key,
    "order":     order,
    "createdAt": Js.Date.make(),
    "data":      data |> js,
    "meta":      Js.Obj.empty() |> js
  };

  let fromJs = (command, data) => {
    "key":       command##key,
    "order":     command##order,
    "createdAt": command##createdAt,
    "data":      data,
    "meta":      command##meta
  };

};

/* State */

module State = {

  exception Missing(string);

  type cqesState('data) = {
    version: int,
    data:    'data
  };

  let toJs = (version, status, data) => {
    "version": version,
    "status":  status,
    "data":    data |> js,
  };

  let fromJs = (state, data) => {
    "version": state##version,
    "status":  state##status,
    "data":    data,
  };

  let next = (state, data) => {
    "version": state##version + 1,
    "data": data,
  };

};
