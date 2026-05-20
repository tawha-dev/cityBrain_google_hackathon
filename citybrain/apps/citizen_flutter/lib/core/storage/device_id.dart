import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

const _key = 'citybrain_device_id';

class DeviceIdService {
  DeviceIdService(this._storage);

  final FlutterSecureStorage _storage;
  String? _cached;

  Future<String> getDeviceId() async {
    if (_cached != null) return _cached!;
    var id = await _storage.read(key: _key);
    if (id == null || id.isEmpty) {
      id = const Uuid().v4();
      await _storage.write(key: _key, value: id);
    }
    _cached = id;
    return id;
  }
}
