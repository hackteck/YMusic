<?php
//die(phpinfo());
//$url = $_SERVER["QUERY_STRING"];
$url = substr($_SERVER["REQUEST_URI"], 1);

//CORS: the browser can't read a response without these, and the preflight
//never reaches the target anyway, so answer it here
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
header("Access-Control-Allow-Headers: *");
header("Access-Control-Expose-Headers: *");
header("Access-Control-Max-Age: 86400");
if ($_SERVER["REQUEST_METHOD"] == "OPTIONS") {
    http_response_code(204);
    exit;
}

if ($url == "") exit("no url given!");

//the target's own origin, to send in place of the browser's
$parts  = parse_url($url);
$origin = isset($parts["scheme"], $parts["host"]) ? $parts["scheme"] . "://" . $parts["host"] : "";
if ($origin != "" && isset($parts["port"])) $origin .= ":" . $parts["port"];

//handle incoming headers
function request_headers($origin)
{
    //Host, Origin and Referer name the proxy, not the target; curl sets Host
    //from the URL itself, and Content-Length would describe the body we replaced
    $drop    = array("host", "origin", "referer", "content-length");
    $headers = $origin == "" ? array() : array("Origin: " . $origin);
    foreach (getallheaders() as $name => $value) {
        //remove dropped, GEOIP and X headers
        if (in_array(strtolower($name), $drop) || strpos($name, "GEOIP_") !== false || strpos($name, "X-") !== false) {
            continue;
        }
        array_push($headers, $name . ": " . $value);
    }
    return $headers;
}

//dissalowed output headers — ours win over whatever the target sends
$disallowed_tags = array(
    "Transfer-Encoding:",
    "Access-Control-"
);

//CURL
$response_headers = array();
$ch               = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, FALSE);
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    //sending post data
    curl_setopt($ch, CURLOPT_POST, TRUE);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($_POST, '', '&'));
}
curl_setopt($ch, CURLOPT_HTTPHEADER, request_headers($origin));
curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($curl, $header) use (&$disallowed_tags)
{
    //fetch incoming and set outgoing headers
    $len    = strlen($header);
    //print($header);
    $header = trim($header);
    //the status line has no colon, so pass it on before the test below drops it
    //— without this PHP answers 200 to a 404
    if (strpos($header, "HTTP/") === 0) {
        $status = explode(" ", $header);
        if (isset($status[1])) http_response_code(intval($status[1]));
        return $len;
    }
    if (strpos($header, ":")) {
        for ($i = 0; $i < count($disallowed_tags); $i++) {
            if (stripos($header, $disallowed_tags[$i]) !== false)
                return $len;
        }
        header($header);
    }
    //must return original header lenght
    return $len;
});
$ok  = curl_exec($ch);
$err = curl_error($ch);
curl_close($ch);
//curl writes nothing when it fails, so say so rather than serve a blank page
if ($ok === FALSE) {
    if (!headers_sent()) http_response_code(502);
    echo "proxy: " . $err;
}
?>
