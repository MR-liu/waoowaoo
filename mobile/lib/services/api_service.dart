import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String _defaultBaseUrl = 'http://localhost:8901/api';

  final String baseUrl;
  String? _authToken;

  ApiService({String? baseUrl}) : baseUrl = baseUrl ?? _defaultBaseUrl;

  void setAuthToken(String token) {
    _authToken = token;
  }

  void clearAuthToken() {
    _authToken = null;
  }

  Map<String, String> get _headers {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (_authToken != null) {
      headers['Authorization'] = 'Bearer $_authToken';
    }
    return headers;
  }

  Future<Map<String, dynamic>> get(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.get(uri, headers: _headers);
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.post(
      uri,
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.delete(uri, headers: _headers);
    return _handleResponse(response);
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    final errorMessage =
        body['message'] as String? ?? 'Request failed (${response.statusCode})';
    throw ApiException(
      statusCode: response.statusCode,
      message: errorMessage,
      code: body['code'] as String?,
    );
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final String? code;

  const ApiException({
    required this.statusCode,
    required this.message,
    this.code,
  });

  @override
  String toString() => 'ApiException($statusCode): $message';
}
