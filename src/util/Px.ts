export class Px<T> extends Promise<T> {

  public static props(record: { [field: string]: Promise<any> }): Promise<any> {
    return new Promise((resolve, reject) => {
      const result = {};
      const promises = [];
      let counter = 1;
      let lastError = <any>null;
      for (const field in record) {
        const promise = record[field];
        counter += 1;
        promise.then(value => {
          result[field] = value;
          counter -= 1;
          if (counter === 0) {
            if (lastError) reject(lastError);
            else resolve(result);
          }
        }).catch(e => {
          result[field] = null;
          counter -= 1;
          lastError = e;
          if (counter === 0) reject(lastError);
        });
      }
      counter -= 1;
      if (counter === 0) {
        if (lastError) reject(lastError);
        else resolve(result);
      }
    });
  }

}